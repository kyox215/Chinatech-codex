'use client';
import {useLanguage} from '@/components/language-provider';
export function ToolIntegrationPending(){const{t}=useLanguage();return <p role="status">{t('版本校验接入中，下载暂未开放。')}</p>;}
