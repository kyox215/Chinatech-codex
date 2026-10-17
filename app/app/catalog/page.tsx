import { BackendPageFrame } from "@/components/backend-page-frame";
import { DeviceCatalogPage } from '@/components/catalog/device-catalog-page';
export default function Page(){return <BackendPageFrame plan={{ kind: "catalog" }}><DeviceCatalogPage/></BackendPageFrame>;}
