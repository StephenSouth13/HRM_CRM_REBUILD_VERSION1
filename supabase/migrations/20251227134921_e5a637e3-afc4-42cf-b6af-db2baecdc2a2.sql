-- Drop the wrong unique constraint on task_columns
ALTER TABLE public.task_columns DROP CONSTRAINT IF EXISTS task_columns_name_created_by_key;

-- Add correct unique constraint (name unique within project)
ALTER TABLE public.task_columns ADD CONSTRAINT task_columns_name_project_id_key UNIQUE (name, project_id);

-- Create function to send notification when task is assigned
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  task_title TEXT;
  creator_name TEXT;
BEGIN
  -- Only trigger when assignee is set or changed
  IF NEW.assignee_id IS NOT NULL AND (OLD.assignee_id IS NULL OR OLD.assignee_id != NEW.assignee_id) THEN
    -- Get creator name
    SELECT COALESCE(first_name || ' ' || last_name, email) INTO creator_name
    FROM profiles
    WHERE id = COALESCE(NEW.creator_id, auth.uid());
    
    -- Insert notification for assignee
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      NEW.assignee_id,
      'task_assigned',
      'Bạn được giao task mới',
      'Bạn được ' || COALESCE(creator_name, 'ai đó') || ' giao task: ' || NEW.title,
      '/tasks'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for task assignment notification
DROP TRIGGER IF EXISTS on_task_assigned ON public.tasks;
CREATE TRIGGER on_task_assigned
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assignment();

-- Create function to notify creator when task is completed (moved to done status)
CREATE OR REPLACE FUNCTION public.notify_task_completed()
RETURNS TRIGGER AS $$
DECLARE
  assignee_name TEXT;
BEGIN
  -- Only trigger when status changes to done
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') AND NEW.creator_id IS NOT NULL THEN
    -- Get assignee name
    SELECT COALESCE(first_name || ' ' || last_name, email) INTO assignee_name
    FROM profiles
    WHERE id = NEW.assignee_id;
    
    -- Only notify if creator is different from assignee
    IF NEW.creator_id != NEW.assignee_id OR NEW.assignee_id IS NULL THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        NEW.creator_id,
        'task_completed',
        'Task đã hoàn thành',
        'Task "' || NEW.title || '" đã được hoàn thành' || 
        CASE WHEN assignee_name IS NOT NULL THEN ' bởi ' || assignee_name ELSE '' END,
        '/tasks'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for task completion notification
DROP TRIGGER IF EXISTS on_task_completed ON public.tasks;
CREATE TRIGGER on_task_completed
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_completed();