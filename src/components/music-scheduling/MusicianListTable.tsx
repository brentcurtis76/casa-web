/**
 * MusicianListTable — Searchable, filterable table of musicians.
 *
 * Uses useMusicians() with 300ms debounced search, instrument filter,
 * active/inactive toggle, and a table with key columns.
 */

import { useState, useMemo } from 'react';
import { useMusicians } from '@/hooks/useMusicLibrary';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Pencil, Trash2, X } from 'lucide-react';
import { INSTRUMENT_LABELS } from '@/lib/music-planning/musicianLabels';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { MusicianListFilters, InstrumentType } from '@/types/musicPlanning';
import useDebounce from '@/hooks/useDebounce';

interface MusicianListTableProps {
  onMusicianClick: (musicianId: string) => void;
  onEditClick: (musicianId: string) => void;
  onDeleteClick: (musicianId: string, name: string) => void;
  canWrite: boolean;
  canManage: boolean;
}

const MusicianListTable = ({
  onMusicianClick,
  onEditClick,
  onDeleteClick,
  canWrite,
  canManage,
}: MusicianListTableProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [instrumentFilter, setInstrumentFilter] = useState<InstrumentType | ''>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const debouncedQuery = useDebounce(searchQuery, 300);

  const filters = useMemo<MusicianListFilters>(() => {
    const f: MusicianListFilters = {};
    if (debouncedQuery) f.query = debouncedQuery;
    if (instrumentFilter) f.instrument = instrumentFilter;
    if (activeFilter === 'active') f.isActive = true;
    if (activeFilter === 'inactive') f.isActive = false;
    return f;
  }, [debouncedQuery, instrumentFilter, activeFilter]);

  const { data: musicians, isLoading, isError } = useMusicians(filters);

  const hasFilters = searchQuery || instrumentFilter || activeFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setInstrumentFilter('');
    setActiveFilter('all');
  };

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select
          value={instrumentFilter}
          onValueChange={(v) => setInstrumentFilter(v === '__all__' ? '' : v as InstrumentType)}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Instrumento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            {(Object.entries(INSTRUMENT_LABELS) as [InstrumentType, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={activeFilter}
          onValueChange={(v) => setActiveFilter(v as 'all' | 'active' | 'inactive')}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters} title="Limpiar filtros" aria-label="Limpiar filtros">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-red-500">
          Error al cargar los músicos. Intenta nuevamente.
        </div>
      ) : !musicians || musicians.length === 0 ? (
        <div className="text-center py-12" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
          {hasFilters
            ? 'No se encontraron músicos con los filtros aplicados.'
            : 'No se encontraron músicos.'}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">Instrumentos</TableHead>
                <TableHead className="hidden md:table-cell">Estado</TableHead>
                {(canWrite || canManage) && <TableHead className="w-20">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {musicians.map((musician) => (
                <TableRow
                  key={musician.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => onMusicianClick(musician.id)}
                >
                  <TableCell>
                    <div>
                      <span className="font-medium" style={{ color: CASA_BRAND.colors.primary.black }}>
                        {musician.display_name}
                      </span>
                      {musician.email && (
                        <p className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                          {musician.email}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {musician.instruments && musician.instruments.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {musician.instruments.map((inst) => (
                          <Badge
                            key={inst.instrument}
                            variant={inst.is_primary ? 'default' : 'outline'}
                            style={inst.is_primary ? {
                              backgroundColor: CASA_BRAND.colors.primary.amber,
                              color: CASA_BRAND.colors.primary.black,
                            } : undefined}
                          >
                            {INSTRUMENT_LABELS[inst.instrument]}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                        --
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={musician.is_active ? 'default' : 'secondary'}>
                      {musician.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  {(canWrite || canManage) && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditClick(musician.id);
                            }}
                            title="Editar"
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteClick(musician.id, musician.display_name);
                            }}
                            title="Eliminar"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {musicians && musicians.length > 0 && (
        <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
          {musicians.length} {musicians.length === 1 ? 'músico encontrado' : 'músicos encontrados'}
        </p>
      )}
    </div>
  );
};

export default MusicianListTable;
