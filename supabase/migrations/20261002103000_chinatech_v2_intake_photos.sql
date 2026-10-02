-- Photo bytes stay outside the shared business snapshot; reading always rechecks membership.
CREATE TABLE chinatech_v2_private.intake_photos (
  store_id uuid NOT NULL,
  repair_id text NOT NULL,
  id uuid NOT NULL,
  slot text NOT NULL CHECK (slot IN ('front','back','other')),
  mime text NOT NULL CHECK (mime = 'image/jpeg'),
  bytes bytea NOT NULL CHECK (octet_length(bytes) BETWEEN 4 AND 240000 AND substring(bytes FROM 1 FOR 3) = decode('ffd8ff','hex') AND substring(bytes FROM octet_length(bytes)-1 FOR 2) = decode('ffd9','hex')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, repair_id, id),
  FOREIGN KEY (store_id, repair_id) REFERENCES chinatech_v2_private.repair_intakes(store_id, id)
);
ALTER TABLE chinatech_v2_private.intake_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE chinatech_v2_private.intake_photos FORCE ROW LEVEL SECURITY;
REVOKE ALL ON chinatech_v2_private.intake_photos FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON chinatech_v2_private.intake_photos TO chinatech_runtime;
CREATE POLICY photo_read ON chinatech_v2_private.intake_photos FOR SELECT TO chinatech_runtime
  USING (chinatech_v2_private.member_access(store_id, 'repairs.view') AND store_id::text = (SELECT current_setting('app.store_id',true)));
CREATE POLICY photo_write ON chinatech_v2_private.intake_photos FOR INSERT TO chinatech_runtime
  WITH CHECK (chinatech_v2_private.member_access(store_id, 'repairs.edit') AND chinatech_v2_private.member_access(store_id, 'repairs.view') AND store_id::text = (SELECT current_setting('app.store_id',true)));
