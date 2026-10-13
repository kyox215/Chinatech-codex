import rows from '@/data/device-catalog/catalog.json';
import sourceData from '@/data/device-catalog/sources.json';
import coverageData from '@/data/device-catalog/coverage.json';
import { validateCatalogEntry, type CatalogRow, type CatalogSource, type CatalogCoverage } from './device-catalog';
export const catalogSeedRows: readonly CatalogRow[] = (rows as unknown[]).map(row => ({ ...validateCatalogEntry(row), version: 1 }));
export const catalogSeedSources = sourceData as CatalogSource[];
export const catalogSeedCoverage = coverageData as CatalogCoverage[];
