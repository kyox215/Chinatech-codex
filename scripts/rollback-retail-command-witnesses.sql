-- Drain the application version using D18 before this atomic rollback.
drop function chinatech_v2_private.command_retail_sale_exists_v1(uuid,text);
drop function chinatech_v2_private.command_retail_conflict_v1(uuid,text,text,text,text,text,text);
drop function chinatech_v2_private.command_retail_origin_witness_v1(uuid,text);
drop function chinatech_v2_private.command_retail_code_witness_v1(uuid,text);
drop function chinatech_v2_private.command_retail_access_v1(uuid);
drop index chinatech_v2_private.retail_command_code_v1;
drop index chinatech_v2_private.retail_command_serial_v1;
drop index chinatech_v2_private.retail_command_imei1_v1;
drop index chinatech_v2_private.retail_command_imei2_v1;
drop index chinatech_v2_private.retail_command_sequence_v1;
drop index chinatech_v2_private.retail_command_sale_ids_v1;
drop index chinatech_v2_private.retail_command_history_origin_v1;
drop function chinatech_v2_private.command_sale_ids_v1(jsonb);
drop function chinatech_v2_private.command_code_sequence_v1(text);
drop function chinatech_v2_private.command_imei_v1(text);
drop function chinatech_v2_private.command_identifier_v1(text);
