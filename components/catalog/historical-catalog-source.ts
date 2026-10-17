import type{ComboboxOption}from'@/components/search-combobox';
export type HistoricalCatalogSource={
 options:readonly(ComboboxOption&{catalogKey?:string|null})[];total:number;loading:boolean;error:string;
 onOpenChange:(open:boolean)=>void;onQueryChange:(query:string)=>void;onSelect:(option:ComboboxOption)=>void;retry:()=>void;
};
