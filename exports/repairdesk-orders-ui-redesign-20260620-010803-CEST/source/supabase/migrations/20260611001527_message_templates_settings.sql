create table if not exists public.store_settings (
  id text primary key default 'default',
  store_name text not null default 'ChinaTech',
  store_address text not null default 'Viale Vittorio Veneto, 7, Floridia (SR)',
  store_phone text not null default '',
  store_whatsapp text not null default '',
  store_email text not null default '',
  default_order_warranty_text text not null default '6个月',
  default_inventory_warranty_months integer not null default 12,
  print_footer text not null default 'Grazie per aver scelto ChinaTech.',
  message_signature text not null default 'ChinaTech - Viale Vittorio Veneto, 7, Floridia (SR)',
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_settings_singleton check (id = 'default'),
  constraint store_settings_inventory_warranty_check check (default_inventory_warranty_months >= 0),
  constraint store_settings_updated_by_fkey
    foreign key (updated_by) references public.staff_profiles(id)
    on delete set null
);

create table if not exists public.message_templates (
  id text primary key,
  domain text not null,
  kind text not null,
  channel text not null,
  language text not null default 'it',
  label text not null,
  body_template text not null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_templates_domain_check check (domain in ('order', 'customer')),
  constraint message_templates_channel_check check (channel in ('whatsapp', 'sms')),
  constraint message_templates_language_check check (language in ('it', 'zh', 'en')),
  constraint message_templates_unique_kind unique (domain, kind, channel, language),
  constraint message_templates_updated_by_fkey
    foreign key (updated_by) references public.staff_profiles(id)
    on delete set null
);

create index if not exists message_templates_domain_sort_idx
  on public.message_templates (domain, sort_order, label);

alter table public.store_settings enable row level security;
alter table public.message_templates enable row level security;

revoke all on table public.store_settings from anon, authenticated;
revoke all on table public.message_templates from anon, authenticated;

grant all on table public.store_settings to service_role;
grant all on table public.message_templates to service_role;

insert into public.store_settings (id)
values ('default')
on conflict (id) do nothing;

insert into public.message_templates (
  id,
  domain,
  kind,
  channel,
  language,
  label,
  body_template,
  enabled,
  sort_order
)
values
  (
    'order_whatsapp_approval_request_it',
    'order',
    'approval_request',
    'whatsapp',
    'it',
    '报价审批',
    $$Gentile {{customer_name}},

le inviamo il preventivo per la riparazione del dispositivo {{device_label}}.
Numero ordine: {{order_no}}

Interventi previsti:
{{fault_lines}}

Totale preventivo: {{quotation}}
Acconto: {{deposit}}
Saldo da pagare: {{balance}}
{{order_url_line}}

La preghiamo di confermare se desidera procedere con la riparazione.
Grazie,
{{message_signature}}$$,
    true,
    10
  ),
  (
    'order_whatsapp_pickup_ready_it',
    'order',
    'pickup_ready',
    'whatsapp',
    'it',
    '可取机通知',
    $$Gentile {{customer_name}},

il dispositivo {{device_label}} e pronto per il ritiro.
Numero ordine: {{order_no}}
Stato: {{order_status}}
{{balance_line}}

Puo passare in negozio per il ritiro.
{{message_signature}}$$,
    true,
    20
  ),
  (
    'order_whatsapp_unfixed_pickup_it',
    'order',
    'unfixed_pickup',
    'whatsapp',
    'it',
    '未修取机',
    $$Gentile {{customer_name}},

la diagnosi del dispositivo {{device_label}} e stata completata.
Numero ordine: {{order_no}}
Al momento il dispositivo non verra riparato.
{{diagnosis_line}}
{{balance_line}}

Puo passare in negozio per il ritiro.
{{message_signature}}$$,
    true,
    30
  ),
  (
    'order_whatsapp_parts_update_it',
    'order',
    'parts_update',
    'whatsapp',
    'it',
    '配件进度',
    $$Gentile {{customer_name}},

aggiornamento per il dispositivo {{device_label}}.
Numero ordine: {{order_no}}
Stato attuale: {{order_status}}

{{parts_update_line}}
{{message_signature}}$$,
    true,
    40
  ),
  (
    'order_whatsapp_repair_status_it',
    'order',
    'repair_status',
    'whatsapp',
    'it',
    '状态更新',
    $$Gentile {{customer_name}},

aggiornamento per il dispositivo {{device_label}}.
Numero ordine: {{order_no}}
Stato attuale: {{order_status}}
{{issue_line}}
{{diagnosis_line}}
{{order_url_line}}

Per qualsiasi domanda siamo a disposizione.
{{message_signature}}$$,
    true,
    50
  ),
  (
    'order_whatsapp_cancelled_it',
    'order',
    'cancelled',
    'whatsapp',
    'it',
    '取消通知',
    $$Gentile {{customer_name}},

l'ordine {{order_no}} per il dispositivo {{device_label}} e stato annullato.
{{cancel_reason_line}}

Per qualsiasi chiarimento puo contattarci.
{{message_signature}}$$,
    true,
    60
  ),
  (
    'order_whatsapp_completed_it',
    'order',
    'completed',
    'whatsapp',
    'it',
    '完成确认',
    $$Gentile {{customer_name}},

l'ordine {{order_no}} risulta completato.
Dispositivo: {{device_label}}
{{balance_line}}

Grazie per aver scelto {{store_name}}.$$,
    true,
    70
  ),
  (
    'customer_whatsapp_general_it',
    'customer',
    'general',
    'whatsapp',
    'it',
    '客户通用消息',
    $$Gentile {{customer_name}},

la contattiamo da {{store_name}} per il servizio di assistenza.
{{latest_order_line}}
Dispositivi registrati: {{device_count}}
{{customer_url_line}}

Restiamo a disposizione per qualsiasi necessita.
Grazie,
{{message_signature}}$$,
    true,
    100
  ),
  (
    'customer_sms_general_it',
    'customer',
    'general',
    'sms',
    'it',
    '客户短信通用',
    $${{store_name}}: Gentile {{customer_name}}, restiamo a disposizione per assistenza. {{customer_url}}$$,
    true,
    110
  )
on conflict (id) do nothing;
