-- Optional color label for companies (fixed palette)

alter table public.companies
  add column color text null
  constraint companies_color_check check (
    color is null
    or color in (
      'red','orange','amber','yellow','lime','green',
      'teal','cyan','blue','indigo','violet','pink','rose','slate'
    )
  );
