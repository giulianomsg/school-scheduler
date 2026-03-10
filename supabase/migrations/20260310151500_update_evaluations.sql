-- Adiciona as novas colunas de avaliação detalhada à tabela appointments

ALTER TABLE public.appointments
ADD COLUMN rating_cordialidade smallint NULL CHECK (rating_cordialidade >= 1 AND rating_cordialidade <= 5),
ADD COLUMN rating_comunicacao smallint NULL CHECK (rating_comunicacao >= 1 AND rating_comunicacao <= 5),
ADD COLUMN rating_organizacao smallint NULL CHECK (rating_organizacao >= 1 AND rating_organizacao <= 5),
ADD COLUMN rating_impressao smallint NULL CHECK (rating_impressao >= 1 AND rating_impressao <= 5);

COMMENT ON COLUMN public.appointments.rating_cordialidade IS 'Avaliação de 1 a 5 para Cordialidade e Postura';
COMMENT ON COLUMN public.appointments.rating_comunicacao IS 'Avaliação de 1 a 5 para Comunicação';
COMMENT ON COLUMN public.appointments.rating_organizacao IS 'Avaliação de 1 a 5 para Organização e Eficiência no Atendimento';
COMMENT ON COLUMN public.appointments.rating_impressao IS 'Avaliação de 1 a 5 para Impressão Geral';
