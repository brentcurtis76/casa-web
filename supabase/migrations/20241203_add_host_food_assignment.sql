-- Add host_food_assignment column to mesa_abierta_matches table
-- This allows hosts to also be assigned food to bring to the dinner

ALTER TABLE mesa_abierta_matches
ADD COLUMN host_food_assignment TEXT CHECK (host_food_assignment IN ('main_course', 'salad', 'drinks', 'dessert'));

-- Add a comment explaining the column
COMMENT ON COLUMN mesa_abierta_matches.host_food_assignment IS 'The food item the host is assigned to bring (main_course, salad, drinks, or dessert)';
