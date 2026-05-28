CREATE TABLE IF NOT EXISTS category_facilities (
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  facility_value text NOT NULL,
  PRIMARY KEY (category_id, facility_value)
);

ALTER TABLE category_facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read category_facilities"
  ON category_facilities FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert category_facilities"
  ON category_facilities FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'contributor')
  ));

CREATE POLICY "Admins can delete category_facilities"
  ON category_facilities FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'contributor')
  ));
