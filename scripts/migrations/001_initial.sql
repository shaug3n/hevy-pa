CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  coach_style text NOT NULL CHECK (coach_style IN ('Encouraging & direct', 'Calm & analytical', 'High energy')),
  current_state text,
  primary_goal text,
  initial_plan text,
  hevy_credential text,
  hevy_masked_suffix text,
  hevy_user_id text,
  hevy_user_name text,
  onboarding_complete boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'UTC',
  units text NOT NULL DEFAULT 'metric' CHECK (units IN ('metric', 'imperial')),
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
  status text NOT NULL CHECK (status IN ('active', 'completed')),
  target_date date,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS goals_owner_updated_idx ON goals (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  status text NOT NULL CHECK (status IN ('active', 'completed')),
  next_item_position integer NOT NULL DEFAULT 0 CHECK (next_item_position >= 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (id, user_id)
);
CREATE INDEX IF NOT EXISTS plans_owner_created_idx ON plans (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS plan_items (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
  status text NOT NULL CHECK (status IN ('pending', 'completed')),
  position integer NOT NULL CHECK (position >= 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  FOREIGN KEY (plan_id, user_id) REFERENCES plans(id, user_id) ON DELETE CASCADE,
  UNIQUE (plan_id, position)
);
CREATE INDEX IF NOT EXISTS plan_items_owner_plan_idx ON plan_items (user_id, plan_id, position);

CREATE TABLE IF NOT EXISTS messages (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 8000),
  cards jsonb,
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_owner_sequence_idx ON messages (user_id, sequence DESC);
