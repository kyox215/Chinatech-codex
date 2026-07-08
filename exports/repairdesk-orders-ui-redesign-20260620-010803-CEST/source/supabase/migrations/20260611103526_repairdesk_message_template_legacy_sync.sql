-- Remote compatibility: the live database still has legacy NOT NULL columns
-- on message_templates (code/type/body/is_active). The current app writes the
-- new template fields, so keep the legacy columns synchronized at insert/update.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'message_templates'
      and column_name = 'code'
  ) then
    execute $sql$
      create or replace function public.repairdesk_sync_message_template_legacy_columns()
      returns trigger
      language plpgsql
      as $fn$
      begin
        new.domain := coalesce(nullif(new.domain, ''), case when new.type = 'customer' then 'customer' else 'order' end);
        new.kind := coalesce(nullif(new.kind, ''), nullif(new.code, ''), 'general');
        new.channel := coalesce(nullif(new.channel, ''), 'whatsapp');
        new.language := lower(coalesce(nullif(new.language, ''), 'it'));
        new.label := coalesce(nullif(new.label, ''), new.kind);
        new.body_template := coalesce(nullif(new.body_template, ''), nullif(new.body, ''), '');
        new.enabled := coalesce(new.enabled, new.is_active, true);
        new.code := coalesce(nullif(new.code, ''), concat_ws('_', new.domain, new.channel, new.kind, new.language));
        new.type := coalesce(nullif(new.type, ''), new.domain);
        new.body := coalesce(nullif(new.body, ''), new.body_template);
        new.is_active := coalesce(new.is_active, new.enabled, true);
        return new;
      end;
      $fn$;
    $sql$;

    drop trigger if exists repairdesk_sync_message_template_legacy_columns_trg
      on public.message_templates;
    create trigger repairdesk_sync_message_template_legacy_columns_trg
    before insert or update on public.message_templates
    for each row execute function public.repairdesk_sync_message_template_legacy_columns();
  end if;
end $$;
