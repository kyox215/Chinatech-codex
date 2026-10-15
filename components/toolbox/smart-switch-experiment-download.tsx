"use client";
import {useLanguage} from '@/components/language-provider';
import {ToolIntegrationPending} from './tool-integration-pending';
import styles from './android-transfer.module.css';
export function SmartSwitchExperimentDownload(){const{t}=useLanguage();return <section id="smart-switch-experiment" className={styles.panel}><h2>{t('Smart Switch 实验版')}</h2><ToolIntegrationPending/></section>;}
