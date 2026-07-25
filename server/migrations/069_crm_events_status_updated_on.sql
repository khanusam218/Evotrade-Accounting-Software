ALTER TABLE crm_events ADD COLUMN IF NOT EXISTS status_updated_on TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION set_crm_event_status_updated_on()
RETURNS TRIGGER AS $func$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_on = NOW();
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_event_status_updated_on ON crm_events;
CREATE TRIGGER trg_crm_event_status_updated_on
  BEFORE UPDATE ON crm_events
  FOR EACH ROW EXECUTE FUNCTION set_crm_event_status_updated_on();
