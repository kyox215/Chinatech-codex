import {defineConfig}from'@playwright/test';
export default defineConfig({testDir:'./tests/browser',testMatch:'performance-read-failure.spec.ts',workers:1,retries:0,use:{browserName:'chromium',viewport:{width:1024,height:900},trace:'retain-on-failure'},reporter:'line'});
