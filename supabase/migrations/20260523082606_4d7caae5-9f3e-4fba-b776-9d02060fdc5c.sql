ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS icon_name text,
  ADD COLUMN IF NOT EXISTS icon_color text;

UPDATE public.categories SET icon_name = COALESCE(icon_name, CASE slug
  WHEN 'reentry-to-recovery' THEN 'RefreshCw'
  WHEN 'mind-rehab' THEN 'Brain'
  WHEN 'resources-partners' THEN 'Handshake'
  WHEN 'narcotics-anonymous' THEN 'CircleDot'
  WHEN 'alcoholics-anonymous' THEN 'Wine'
  WHEN 'personal-finance' THEN 'Wallet'
  WHEN 'recovery' THEN 'Sparkles'
  WHEN 'health-and-wellness' THEN 'Heart'
  WHEN 'ged' THEN 'GraduationCap'
  WHEN 'parenting' THEN 'Users'
  WHEN 'devotional-books' THEN 'BookOpen'
  WHEN 'books' THEN 'Library'
  WHEN 'galleries-devotion' THEN 'Image'
  WHEN 'workforce-integration' THEN 'Briefcase'
  WHEN 'education' THEN 'School'
  WHEN 'cover-letter-resume' THEN 'FileText'
  WHEN 'english-study-sheets' THEN 'BookA'
  WHEN 'math-study-sheets' THEN 'Calculator'
  WHEN 'legal-information' THEN 'Scale'
  WHEN 'learning-center' THEN 'Lightbulb'
END);

UPDATE public.categories SET icon_color = COALESCE(icon_color, CASE slug
  WHEN 'reentry-to-recovery' THEN 'oklch(0.45 0.09 165)'
  WHEN 'mind-rehab' THEN 'oklch(0.45 0.10 280)'
  WHEN 'resources-partners' THEN 'oklch(0.48 0.08 210)'
  WHEN 'narcotics-anonymous' THEN 'oklch(0.45 0.04 250)'
  WHEN 'alcoholics-anonymous' THEN 'oklch(0.45 0.10 330)'
  WHEN 'personal-finance' THEN 'oklch(0.52 0.10 85)'
  WHEN 'recovery' THEN 'oklch(0.48 0.09 145)'
  WHEN 'health-and-wellness' THEN 'oklch(0.50 0.11 15)'
  WHEN 'ged' THEN 'oklch(0.50 0.10 70)'
  WHEN 'parenting' THEN 'oklch(0.50 0.10 40)'
  WHEN 'devotional-books' THEN 'oklch(0.48 0.08 110)'
  WHEN 'books' THEN 'oklch(0.42 0.10 20)'
  WHEN 'galleries-devotion' THEN 'oklch(0.48 0.10 305)'
  WHEN 'workforce-integration' THEN 'oklch(0.42 0.07 200)'
  WHEN 'education' THEN 'oklch(0.40 0.08 155)'
  WHEN 'cover-letter-resume' THEN 'oklch(0.46 0.08 195)'
  WHEN 'english-study-sheets' THEN 'oklch(0.48 0.06 140)'
  WHEN 'math-study-sheets' THEN 'oklch(0.45 0.07 240)'
  WHEN 'legal-information' THEN 'oklch(0.45 0.04 70)'
  WHEN 'learning-center' THEN 'oklch(0.55 0.11 90)'
END);