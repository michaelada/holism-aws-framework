import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Typography,
  TextField,
  TableSortLabel,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { List, type ListImperativeAPI } from 'react-window';
import type { FieldDefinition, ListQueryParams } from '../../types';
import { useMetadata, useObjectInstances } from '../../hooks';
import type { ColumnDefinition } from './MetadataTable';

export interface VirtualizedMetadataTableProps {
  objectType: string;
  onRowClick?: (instance: any) => void;
  onEdit?: (instance: any) => void;
  onDelete?: (instance: any) => void;
  customColumns?: ColumnDefinition[];
  rowHeight?: number;
  height?: number;
}

/**
 * VirtualizedMetadataTable component with virtual scrolling for large datasets
 * Uses react-window for efficient rendering of thousands of rows
 * 
 * @example
 * ```tsx
 * <VirtualizedMetadataTable
 *   objectType="customer"
 *   height={600}
 *   rowHeight={52}
 *   onEdit={(instance) => navigate(`/customers/${instance.id}/edit`)}
 * />
 * ```
 */
export function VirtualizedMetadataTable({
  objectType,
  onRowClick,
  onEdit,
  onDelete,
  customColumns,
  rowHeight = 52,
  height = 600,
}: VirtualizedMetadataTableProps): JSX.Element {
  const { objectDef, fields, loading: metadataLoading, error: metadataError } = useMetadata(objectType);
  const { instances, loading: instancesLoading, error: instancesError, fetchInstances } = useObjectInstances(objectType);

  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const listRef = useRef<ListImperativeAPI>(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch all instances (no pagination for virtual scrolling)
  useEffect(() => {
    if (objectDef) {
      const params: ListQueryParams = {
        page: 1,
        pageSize: 10000, // Fetch large batch for virtual scrolling
        sortBy,
        sortOrder,
        search: debouncedSearchTerm || undefined,
      };
      fetchInstances(params);
    }
  }, [objectDef, sortBy, sortOrder, debouncedSearchTerm, fetchInstances]);

  // Initialize sort from object definition
  useEffect(() => {
    if (objectDef && !sortBy && objectDef.displayProperties.defaultSortField) {
      setSortBy(objectDef.displayProperties.defaultSortField);
      setSortOrder(objectDef.displayProperties.defaultSortOrder || 'asc');
    }
  }, [objectDef, sortBy]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    // Scroll to top when sorting changes
    if (listRef.current?.element) {
      listRef.current.element.scrollTop = 0;
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    // Scroll to top when search changes
    if (listRef.current?.element) {
      listRef.current.element.scrollTop = 0;
    }
  };

  const getColumns = useCallback((): ColumnDefinition[] => {
    if (customColumns) {
      return customColumns;
    }

    if (!objectDef || !fields) {
      return [];
    }

    const columnFields = objectDef.displayProperties.tableColumns || fields.map(f => f.shortName);

    return columnFields.map(fieldShortName => {
      const field = fields.find(f => f.shortName === fieldShortName);
      if (!field) {
        return {
          field: fieldShortName,
          headerName: fieldShortName,
        };
      }

      return {
        field: field.shortName,
        headerName: field.displayName,
        renderCell: (value: any) => formatCellValue(value, field),
      };
    });
  }, [objectDef, fields, customColumns]);

  const formatCellValue = (value: any, field: FieldDefinition): string => {
    if (value === null || value === undefined) {
      return '';
    }

    switch (field.datatype) {
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'datetime':
        return new Date(value).toLocaleString();
      case 'time':
        return new Date(value).toLocaleTimeString();
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'multi_select':
        if (Array.isArray(value)) {
          return value.join(', ');
        } else if (typeof value === 'object') {
          // Handle object case (e.g., JSONB from database)
          return JSON.stringify(value);
        } else {
          return String(value);
        }
      default:
        // Handle any other object types
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return String(value);
    }
  };

  const columns = getColumns();
  const hasActions = onRowClick || onEdit || onDelete;

  // Row renderer for virtual list
  const Row = ({ index, style, ariaAttributes }: { 
    index: number; 
    style: React.CSSProperties;
    ariaAttributes: {
      'aria-posinset': number;
      'aria-setsize': number;
      role: 'listitem';
    };
  }) => {
    const instance = instances[index];

    return (
      <Box
        {...ariaAttributes}
        style={style}
        sx={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
          cursor: onRowClick ? 'pointer' : 'default',
        }}
        onClick={onRowClick ? () => onRowClick(instance) : undefined}
      >
        {columns.map((column, colIndex) => (
          <Box
            key={column.field}
            sx={{
              flex: column.width ? `0 0 ${column.width}px` : 1,
              px: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {column.renderCell
              ? column.renderCell(instance[column.field], instance)
              : instance[column.field]}
          </Box>
        ))}
        {hasActions && (
          <Box
            sx={{
              flex: '0 0 150px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1,
              px: 2,
            }}
          >
            {onRowClick && (
              <Tooltip title="View">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRowClick(instance);
                  }}
                >
                  <ViewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {onEdit && (
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(instance);
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {onDelete && (
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(instance);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}
      </Box>
    );
  };

  if (metadataLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (metadataError) {
    return (
      <Alert severity="error">
        Failed to load metadata: {metadataError.message}
      </Alert>
    );
  }

  if (!objectDef || !fields) {
    return (
      <Alert severity="error">
        Object definition not found
      </Alert>
    );
  }

  return (
    <Box>
      {/* Search input */}
      {objectDef.displayProperties.searchableFields && objectDef.displayProperties.searchableFields.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            label="Search"
            variant="outlined"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder={`Search in ${objectDef.displayProperties.searchableFields.join(', ')}`}
          />
        </Box>
      )}

      {instancesError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load instances: {instancesError.message}
        </Alert>
      )}

      <Paper>
        {/* Table header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: 2,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            height: rowHeight,
          }}
        >
          {columns.map((column) => (
            <Box
              key={column.field}
              sx={{
                flex: column.width ? `0 0 ${column.width}px` : 1,
                px: 2,
              }}
            >
              <TableSortLabel
                active={sortBy === column.field}
                direction={sortBy === column.field ? sortOrder : 'asc'}
                onClick={() => handleSort(column.field)}
              >
                {column.headerName}
              </TableSortLabel>
            </Box>
          ))}
          {hasActions && (
            <Box
              sx={{
                flex: '0 0 150px',
                px: 2,
                textAlign: 'right',
              }}
            >
              Actions
            </Box>
          )}
        </Box>

        {/* Virtual list */}
        {instancesLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height={height}>
            <CircularProgress size={24} />
          </Box>
        ) : instances.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" height={height}>
            <Typography color="text.secondary">No data available</Typography>
          </Box>
        ) : (
          <List
            listRef={listRef}
            style={{ height, width: '100%' }}
            rowCount={instances.length}
            rowHeight={rowHeight}
            rowComponent={Row}
            rowProps={{} as any}
          />
        )}
      </Paper>

      {/* Row count indicator */}
      <Box sx={{ mt: 1, textAlign: 'right' }}>
        <Typography variant="caption" color="text.secondary">
          Showing {instances.length} rows
        </Typography>
      </Box>
    </Box>
  );
}
