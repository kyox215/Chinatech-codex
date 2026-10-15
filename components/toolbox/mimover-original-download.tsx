"use client";
import {useLanguage} from '@/components/language-provider';
import {ToolIntegrationPending} from './tool-integration-pending';
import styles from './android-transfer.module.css';
export function MimoverOriginalDownload(){const{t}=useLanguage();return <section id="mimover-original" className={styles.panel}><h2>{t('Mi Mover 实验版')}</h2><ToolIntegrationPending/></section>;}
