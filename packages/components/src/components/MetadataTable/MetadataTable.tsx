import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  TextField,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import type { ObjectDefinition, FieldDefinition, ListQueryParams } from '../../types';
import { useMetadata, useObjectInstances } from '../../hooks';

export interface ColumnDefinition {
  field: string;
  headerName: string;
  width?: number;
  renderCell?: (value: any, row: any) => React.ReactNode;
}

export interface MetadataTableProps {
  objectType: string;
  onRowClick?: (instance: any) => void;
  onEdit?: (instance: any) => void;
  onDelete?: (instance: any) => void;
  customColumns?: ColumnDefinition[];
  pageSize?: number;
}

/**
 * MetadataTable component that renders a sortable, filterable table based on Object Definition
 * - Displays columns specified in displayProperties
 * - Implements row actions (view, edit, delete)
 * - Supports sorting by clicking column headers
 * - Supports filtering using search input
 * - Implements pagination for large datasets
 * 
 * @example
 * ```tsx
 * <MetadataTable
 *   objectType="customer"
 *   onEdit={(instance) => navigate(`/customers/${instance.id}/edit`)}
 *   onDelete={async (instance) => {
 *     if (confirm('Delete?')) await deleteInstance(instance.id);
 *   }}
 *   pageSize={20}
 * />
 * ```
 */
export function MetadataTable({
  objectType,
  onRowClick,
  onEdit,
  onDelete,
  customColumns,
  pageSize: initialPageSize = 20,
}: MetadataTableProps): JSX.Element {
  const { objectDef, fields, loading: metadataLoading, error: metadataError } = useMetadata(objectType);
  const { instances, pagination, loading: instancesLoading, error: instancesError, fetchInstances } = useObjectInstances(objectType);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialPageSize);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch instances when parameters change
  useEffect(() => {
    if (objectDef) {
      const params: ListQueryParams = {
        page: page + 1, // API uses 1-based pagination
        pageSize: rowsPerPage,
        sortBy,
        sortOrder,
        search: debouncedSearchTerm || undefined,
      };
      fetchInstances(params);
    }
  }, [objectDef, page, rowsPerPage, sortBy, sortOrder, debouncedSearchTerm, fetchInstances]);

  // Initialize sort from object definition
  useEffect(() => {
    if (objectDef && !sortBy && objectDef.displayProperties.defaultSortField) {
      setSortBy(objectDef.displayProperties.defaultSortField);
      setSortOrder(objectDef.displayProperties.defaultSortOrder || 'asc');
    }
  }, [objectDef, sortBy]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      // Toggle sort order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortBy(field);
      setSortOrder('asc');
    }
    // Reset to first page when sorting changes
    setPage(0);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(0); // Reset to first page when search changes
  };

  const getColumns = useCallback((): ColumnDefinition[] => {
    if (customColumns) {
      return customColumns;
    }

    if (!objectDef || !fields) {
      return [];
    }

    // Use fields with inTable=true, or fall back to tableColumns from displayProperties
    let columnFields: string[];
    
    // Check if any field has inTable property defined
    const hasInTableProperty = objectDef.fields.some(f => f.inTable !== undefined);
    
    if (hasInTableProperty) {
      // Use inTable property to determine which fields to show
      columnFields = objectDef.fields
        .filter(f => f.inTable !== false)  // Show if inTable is true or undefined
        .map(f => f.fieldShortName);
    } else if (objectDef.displayProperties.tableColumns) {
      // Fall back to tableColumns from displayProperties
      columnFields = objectDef.displayProperties.tableColumns;
    } else {
      // Fall back to all fields
      columnFields = fields.map(f => f.shortName);
    }

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
        return Array.isArray(value) ? value.join(', ') : String(value);
      default:
        return String(value);
    }
  };

  const columns = getColumns();
  const hasActions = onRowClick || onEdit || onDelete;

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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.field}>
                  <TableSortLabel
                    active={sortBy === column.field}
                    direction={sortBy === column.field ? sortOrder : 'asc'}
                    onClick={() => handleSort(column.field)}
                  >
                    {column.headerName}
                  </TableSortLabel>
                </TableCell>
              ))}
              {hasActions && (
                <TableCell align="right">Actions</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {instancesLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (hasActions ? 1 : 0)} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : instances.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (hasActions ? 1 : 0)} align="center">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              instances.map((instance: any) => (
                <TableRow
                  key={instance.id}
                  hover
                  onClick={onRowClick ? () => onRowClick(instance) : undefined}
                  sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.map((column) => (
                    <TableCell key={column.field}>
                      {column.renderCell
                        ? column.renderCell(instance[column.field], instance)
                        : instance[column.field]}
                    </TableCell>
                  ))}
                  {hasActions && (
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
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
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {pagination && (
        <TablePagination
          component="div"
          count={pagination.totalItems}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      )}
    </Box>
  );
}
