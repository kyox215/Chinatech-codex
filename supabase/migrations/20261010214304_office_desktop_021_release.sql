-- Release 0.2.1: extend only the supported client cap and retain the verified 0.2.0 minimum during cutover.
-- No release marker, control row, capability, license, role or column grant is changed here.
alter policy desktop_public_grant_create on chinatech_v2_private.office_desktop_public_grants
 with check(current_setting('app.office_desktop_public_issue',true)='true' and id::text=current_setting('app.office_desktop_grant_id',true) and installation_id::text=current_setting('app.office_desktop_installation',true)
 and exists(select 1 from chinatech_v2_private.office_desktop_control d cross join chinatech_v2_private.office_command_control c where d.singleton and d.enabled and c.singleton and c.enabled and epoch=c.command_version and chinatech_v2_private.desktop_version_parts(app_version)>=chinatech_v2_private.desktop_version_parts(d.minimum_version) and chinatech_v2_private.desktop_version_parts(app_version)<=array[0,2,1]));

alter policy desktop_control_update on chinatech_v2_private.office_desktop_control
 with check(chinatech_v2_private.office_desktop_admin() and updated_by=auth.uid() and (minimum_version='0.0.0' or (release_ready and verified_version is not null and (minimum_version=verified_version or (minimum_version='0.2.0' and chinatech_v2_private.desktop_version_parts(verified_version)>=array[0,2,0])))));
