-- supabase/migrations/1362_wacrm_notify_trigger.sql
-- Trigger NOTIFY untuk SSE real-time: setiap INSERT di wacrm_messages
-- akan memanggil pg_notify ke channel 'wacrm_<org_id>' (hyphen → underscore).

CREATE OR REPLACE FUNCTION public.notify_wacrm_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify(
    'wacrm_' || replace(NEW.org_id::text, '-', '_'),
    json_build_object(
      'id',         NEW.id,
      'contact_id', NEW.contact_id,
      'direction',  NEW.direction,
      'body',       NEW.body,
      'sent_at',    NEW.sent_at,
      'delivered',  NEW.delivered,
      'read_at',    NEW.read_at
    )::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wacrm_message_inserted ON public.wacrm_messages;
CREATE TRIGGER wacrm_message_inserted
  AFTER INSERT ON public.wacrm_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_wacrm_message();
