import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';

export interface AdminTableColumn<T> {
  id: string;
  label: string;
  render: (row: T) => ReactNode;
  /** Return a comparable value to make the column sortable. Omit for no sorting. */
  sortValue?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  /**
   * Cells truncate with an ellipsis by default so a 200-character display name
   * cannot inflate a row or force the whole table to scroll sideways. Set
   * `false` for cells that must show their content in full (chips, actions).
   */
  truncate?: boolean;
}

export interface AdminTableBulkAction<T> {
  id: string;
  label: string;
  icon?: ReactNode;
  colour?: 'inherit' | 'primary' | 'error';
  onRun: (rows: T[]) => void;
}

export interface AdminTableProps<T> {
  rows: T[];
  columns: AdminTableColumn<T>[];
  getRowId: (row: T) => string;
  loading?: boolean;
  /** Accessible name for the table. Required — screen readers land here first. */
  ariaLabel: string;
  /** Fields searched by the toolbar's search box. Omit to hide search. */
  searchFields?: (row: T) => (string | null | undefined)[];
  searchPlaceholder?: string;
  /** Rendered at the right of the toolbar, e.g. a Create button or a filter. */
  toolbarActions?: ReactNode;
  /** Enables the checkbox column and the bulk-action bar. */
  bulkActions?: AdminTableBulkAction<T>[];
  /** Opening a row: fires on Enter, or on a row click when set. */
  onRowOpen?: (row: T) => void;
  /** Bound to the `n` shortcut and announced in the empty state. */
  onCreate?: () => void;
  createLabel?: string;
  /** Shown when there are no rows at all (as opposed to no search matches). */
  emptyState?: ReactNode;
  /**
   * Namespace for this table's URL parameters, so filters survive navigating to
   * a detail page and back instead of being retyped every time.
   */
  urlKey?: string;
}

type SortDirection = 'asc' | 'desc';

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1; // blanks sort last, both directions
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * The one table this app uses.
 *
 * It exists because six pages had each hand-rolled the same `TableContainer` /
 * `TableHead` / right-aligned-icon-column structure, and none of them had
 * sorting, pagination, selection or a single keyboard shortcut — on a tool
 * whose users are a small internal team that lives in these lists all day.
 *
 * Pagination is client-side. The admin API returns whole collections and has no
 * paged endpoints, and adapting the front end to the backend that exists beats
 * expanding the backend to suit the front end. It still removes the real cost,
 * which was rendering every row of every collection into the DOM at once.
 */
export function AdminTable<T>({
  rows,
  columns,
  getRowId,
  loading = false,
  ariaLabel,
  searchFields,
  searchPlaceholder = 'Search',
  toolbarActions,
  bulkActions,
  onRowOpen,
  onCreate,
  createLabel = 'New',
  emptyState,
  urlKey = 't',
}: AdminTableProps<T>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const qKey = `${urlKey}q`;
  const sortKey = `${urlKey}sort`;
  const dirKey = `${urlKey}dir`;
  const pageKey = `${urlKey}page`;

  const query = searchParams.get(qKey) ?? '';
  const sortColumn = searchParams.get(sortKey) ?? '';
  const sortDirection = (searchParams.get(dirKey) as SortDirection) || 'asc';
  const page = Math.max(0, Number(searchParams.get(pageKey) ?? '0') || 0);

  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(changes).forEach(([key, value]) => {
            if (value === null || value === '') next.delete(key);
            else next.set(key, value);
          });
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const filtered = useMemo(() => {
    if (!query || !searchFields) return rows;
    const needle = query.toLowerCase();
    return rows.filter((row) =>
      searchFields(row).some((field) => (field ?? '').toLowerCase().includes(needle))
    );
  }, [rows, query, searchFields]);

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.id === sortColumn && c.sortValue);
    if (!column?.sortValue) return filtered;
    const factor = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort(
      (a, b) => factor * compareValues(column.sortValue!(a), column.sortValue!(b))
    );
  }, [filtered, columns, sortColumn, sortDirection]);

  const pageStart = page * rowsPerPage;
  const visible = useMemo(
    () => sorted.slice(pageStart, pageStart + rowsPerPage),
    [sorted, pageStart, rowsPerPage]
  );

  // A filter that empties the current page would otherwise strand the operator
  // on a blank page with rows they cannot see.
  useEffect(() => {
    if (page > 0 && pageStart >= sorted.length) {
      updateParams({ [pageKey]: null });
    }
  }, [page, pageStart, sorted.length, pageKey, updateParams]);

  // Selections must not survive a filter change, or a bulk action would silently
  // act on rows that are no longer on screen.
  useEffect(() => {
    setSelected(new Set());
  }, [query]);

  const handleSort = (columnId: string) => {
    const nextDirection: SortDirection =
      sortColumn === columnId && sortDirection === 'asc' ? 'desc' : 'asc';
    updateParams({ [sortKey]: columnId, [dirKey]: nextDirection, [pageKey]: null });
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(getRowId(r)));
  const someVisibleSelected = visible.some((r) => selected.has(getRowId(r))) && !allVisibleSelected;

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((r) => next.delete(getRowId(r)));
      else visible.forEach((r) => next.add(getRowId(r)));
      return next;
    });
  };

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(getRowId(r))),
    [rows, selected, getRowId]
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

    if (event.key === '/' && !typing) {
      event.preventDefault();
      searchInputRef.current?.focus();
      return;
    }
    if (event.key === 'n' && !typing && onCreate) {
      event.preventDefault();
      onCreate();
      return;
    }
    if (typing) return;

    if (event.key === 'j' || event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusedIndex((i) => Math.min(visible.length - 1, i + 1));
    } else if (event.key === 'k' || event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex((i) => Math.max(0, i - 1));
    } else if (event.key === 'Enter' && focusedIndex >= 0 && onRowOpen) {
      event.preventDefault();
      onRowOpen(visible[focusedIndex]);
    } else if (event.key === 'x' && focusedIndex >= 0 && bulkActions?.length) {
      event.preventDefault();
      toggleRow(getRowId(visible[focusedIndex]));
    }
  };

  const columnCount = columns.length + (bulkActions?.length ? 1 : 0);
  const hasRows = rows.length > 0;
  const hasMatches = sorted.length > 0;

  return (
    <Paper variant="outlined" ref={containerRef} onKeyDown={handleKeyDown}>
      <Toolbar
        sx={{
          gap: 2,
          py: 1.5,
          flexWrap: 'wrap',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {searchFields && (
          <TextField
            inputRef={searchInputRef}
            size="small"
            value={query}
            onChange={(e) => updateParams({ [qKey]: e.target.value, [pageKey]: null })}
            placeholder={searchPlaceholder}
            // On the input itself, not the TextField wrapper: an `aria-label`
            // prop on TextField lands on the surrounding div, which leaves the
            // actual control unnamed for screen readers.
            inputProps={{ 'aria-label': searchPlaceholder }}
            sx={{ minWidth: 220 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        )}
        <Box sx={{ flexGrow: 1 }} />
        {toolbarActions}
      </Toolbar>

      {bulkActions && selected.size > 0 && (
        <Toolbar
          sx={{
            gap: 1,
            py: 1,
            bgcolor: 'action.selected',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {selected.size} selected
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          {bulkActions.map((action) => (
            <Button
              key={action.id}
              size="small"
              variant="outlined"
              color={action.colour === 'error' ? 'error' : 'inherit'}
              startIcon={action.icon}
              onClick={() => action.onRun(selectedRows)}
            >
              {action.label}
            </Button>
          ))}
        </Toolbar>
      )}

      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table aria-label={ariaLabel} size="small">
          <TableHead>
            <TableRow>
              {bulkActions && (
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected}
                    onChange={toggleAllVisible}
                    inputProps={{ 'aria-label': 'Select all rows on this page' }}
                  />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  style={{ width: column.width }}
                  sortDirection={sortColumn === column.id ? sortDirection : false}
                >
                  {column.sortValue ? (
                    <TableSortLabel
                      active={sortColumn === column.id}
                      direction={sortColumn === column.id ? sortDirection : 'asc'}
                      onClick={() => handleSort(column.id)}
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
            {loading && (
              <TableRow>
                <TableCell colSpan={columnCount} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Loading…
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!loading && !hasRows && (
              <TableRow>
                <TableCell colSpan={columnCount} sx={{ py: 6 }}>
                  {emptyState ?? (
                    <Typography variant="body2" color="text.secondary" align="center">
                      Nothing here yet.
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            )}

            {!loading && hasRows && !hasMatches && (
              <TableRow>
                <TableCell colSpan={columnCount} sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary" align="center">
                    No matches for “{query}”. Clear the search to see all {rows.length} rows.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              visible.map((row, index) => {
                const id = getRowId(row);
                const isSelected = selected.has(id);
                return (
                  <TableRow
                    key={id}
                    hover
                    selected={isSelected}
                    tabIndex={-1}
                    sx={
                      focusedIndex === index
                        ? { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' }
                        : undefined
                    }
                  >
                    {bulkActions && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleRow(id)}
                          inputProps={{ 'aria-label': `Select row ${index + 1 + pageStart}` }}
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell
                        key={column.id}
                        align={column.align}
                        sx={
                          column.truncate === false
                            ? undefined
                            : {
                                maxWidth: column.width ?? 260,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }
                        }
                      >
                        {column.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </TableContainer>

      {hasMatches && (
        <TablePagination
          component="div"
          count={sorted.length}
          page={page}
          onPageChange={(_, next) => updateParams({ [pageKey]: next === 0 ? null : String(next) })}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            updateParams({ [pageKey]: null });
          }}
          rowsPerPageOptions={[25, 50, 100]}
        />
      )}

      {(onCreate || onRowOpen) && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Shortcuts: <strong>/</strong> search
            {onCreate && (
              <>
                {' · '}
                <strong>n</strong> {createLabel.toLowerCase()}
              </>
            )}
            {' · '}
            <strong>j</strong>/<strong>k</strong> move
            {onRowOpen && (
              <>
                {' · '}
                <strong>Enter</strong> open
              </>
            )}
            {bulkActions?.length ? (
              <>
                {' · '}
                <strong>x</strong> select
              </>
            ) : null}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
