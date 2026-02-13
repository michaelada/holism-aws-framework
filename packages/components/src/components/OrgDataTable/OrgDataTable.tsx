import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Paper,
  TextField,
  Box,
  Button,
  IconButton,
  Checkbox,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
  Card,
  CardContent,
  Stack,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

export interface OrgDataTableColumn<T = any> {
  id: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string | number;
}

export interface OrgDataTableProps<T = any> {
  columns: OrgDataTableColumn<T>[];
  data: T[];
  title?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  exportable?: boolean;
  exportFilename?: string;
  selectable?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  getRowId?: (row: T) => string;
  defaultSortColumn?: string;
  defaultSortDirection?: 'asc' | 'desc';
  rowsPerPageOptions?: number[];
  defaultRowsPerPage?: number;
  emptyMessage?: string;
  loading?: boolean;
}

type Order = 'asc' | 'desc';

export function OrgDataTable<T extends Record<string, any>>({
  columns,
  data,
  title,
  searchable = true,
  searchPlaceholder = 'Search...',
  exportable = true,
  exportFilename = 'export',
  selectable = false,
  onSelectionChange,
  getRowId = (row) => row.id,
  defaultSortColumn,
  defaultSortDirection = 'asc',
  rowsPerPageOptions = [10, 25, 50, 100],
  defaultRowsPerPage = 10,
  emptyMessage = 'No data available',
  loading = false,
}: OrgDataTableProps<T>) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [orderBy, setOrderBy] = useState<string>(defaultSortColumn || columns[0]?.id || '');
  const [order, setOrder] = useState<Order>(defaultSortDirection);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  // Sorting logic
  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // Selection logic
  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelected = filteredAndSortedData.map((row) => getRowId(row));
      setSelected(newSelected);
      onSelectionChange?.(newSelected);
      return;
    }
    setSelected([]);
    onSelectionChange?.([]);
  };

  const handleRowClick = (id: string) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected: string[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1)
      );
    }

    setSelected(newSelected);
    onSelectionChange?.(newSelected);
  };

  const isSelected = (id: string) => selected.indexOf(id) !== -1;

  // Filtering and sorting
  const filteredAndSortedData = useMemo(() => {
    let filtered = [...data];

    // Apply search filter
    if (searchTerm && searchable) {
      filtered = filtered.filter((row) =>
        columns.some((column) => {
          const value = row[column.id];
          if (value == null) return false;
          return String(value).toLowerCase().includes(searchTerm.toLowerCase());
        })
      );
    }

    // Apply sorting
    if (orderBy) {
      filtered.sort((a, b) => {
        const aValue = a[orderBy];
        const bValue = b[orderBy];

        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return order === 'asc' ? 1 : -1;
        if (bValue == null) return order === 'asc' ? -1 : 1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return order === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (aValue < bValue) return order === 'asc' ? -1 : 1;
        if (aValue > bValue) return order === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerm, orderBy, order, columns, searchable]);

  // Pagination
  const paginatedData = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredAndSortedData.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredAndSortedData, page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // CSV Export
  const handleExport = () => {
    const csvContent = [
      // Header row
      columns.map((col) => col.label).join(','),
      // Data rows
      ...filteredAndSortedData.map((row) =>
        columns
          .map((col) => {
            const value = row[col.id];
            // Escape quotes and wrap in quotes if contains comma
            const stringValue = String(value ?? '');
            if (stringValue.includes(',') || stringValue.includes('"')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${exportFilename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Mobile card view
  if (isMobile) {
    return (
      <Box>
        {(title || searchable || exportable) && (
          <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 } }}>
            <Box sx={{ flex: '1 1 100%' }}>
              {title && (
                <Typography variant="h6" component="div">
                  {title}
                </Typography>
              )}
              {searchable && (
                <TextField
                  size="small"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                  sx={{ mt: 1, width: '100%' }}
                />
              )}
            </Box>
            {exportable && (
              <IconButton onClick={handleExport} disabled={filteredAndSortedData.length === 0}>
                <DownloadIcon />
              </IconButton>
            )}
          </Toolbar>
        )}

        <Stack spacing={2} sx={{ p: 2 }}>
          {paginatedData.length === 0 ? (
            <Card>
              <CardContent>
                <Typography color="textSecondary" align="center">
                  {emptyMessage}
                </Typography>
              </CardContent>
            </Card>
          ) : (
            paginatedData.map((row) => {
              const rowId = getRowId(row);
              const isItemSelected = isSelected(rowId);

              return (
                <Card key={rowId}>
                  <CardContent>
                    {selectable && (
                      <Checkbox
                        checked={isItemSelected}
                        onChange={() => handleRowClick(rowId)}
                      />
                    )}
                    {columns.map((column) => (
                      <Box key={column.id} sx={{ mb: 1 }}>
                        <Typography variant="caption" color="textSecondary">
                          {column.label}
                        </Typography>
                        <Typography variant="body2">
                          {column.render ? column.render(row) : row[column.id]}
                        </Typography>
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              );
            })
          )}
        </Stack>

        <TablePagination
          rowsPerPageOptions={rowsPerPageOptions}
          component="div"
          count={filteredAndSortedData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Box>
    );
  }

  // Desktop table view
  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      {(title || searchable || exportable) && (
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 } }}>
          <Box sx={{ flex: '1 1 100%' }}>
            {title && (
              <Typography variant="h6" component="div">
                {title}
              </Typography>
            )}
          </Box>
          {searchable && (
            <TextField
              size="small"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
              }}
              sx={{ mr: 2, minWidth: 250 }}
            />
          )}
          {exportable && (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={filteredAndSortedData.length === 0}
            >
              Export CSV
            </Button>
          )}
        </Toolbar>
      )}

      <TableContainer>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={
                      selected.length > 0 && selected.length < filteredAndSortedData.length
                    }
                    checked={
                      filteredAndSortedData.length > 0 &&
                      selected.length === filteredAndSortedData.length
                    }
                    onChange={handleSelectAllClick}
                  />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align || 'left'}
                  style={{ width: column.width }}
                >
                  {column.sortable !== false ? (
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => handleRequestSort(column.id)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} align="center">
                  <Typography color="textSecondary">Loading...</Typography>
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} align="center">
                  <Typography color="textSecondary">{emptyMessage}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row) => {
                const rowId = getRowId(row);
                const isItemSelected = isSelected(rowId);

                return (
                  <TableRow
                    hover
                    key={rowId}
                    selected={isItemSelected}
                    onClick={selectable ? () => handleRowClick(rowId) : undefined}
                    sx={{ cursor: selectable ? 'pointer' : 'default' }}
                  >
                    {selectable && (
                      <TableCell padding="checkbox">
                        <Checkbox checked={isItemSelected} />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell key={column.id} align={column.align || 'left'}>
                        {column.render ? column.render(row) : row[column.id]}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={rowsPerPageOptions}
        component="div"
        count={filteredAndSortedData.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
}
