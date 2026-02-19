import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SchoolUnitComboboxProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SchoolUnitCombobox({ value, onChange }: SchoolUnitComboboxProps) {
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState<{ id: string; nome_escola: string }[]>([]);

  useEffect(() => {
    supabase
      .from("unidades_escolares")
      .select("id, nome_escola")
      .order("nome_escola")
      .then(({ data }) => setUnits(data || []));
  }, []);

  const selectedLabel = units.find((u) => u.id === value)?.nome_escola;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {selectedLabel || "Selecione uma unidade escolar..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar unidade escolar..." />
          <CommandList>
            <CommandEmpty>Nenhuma unidade encontrada.</CommandEmpty>
            <CommandGroup>
              {units.map((unit) => (
                <CommandItem
                  key={unit.id}
                  value={unit.nome_escola}
                  onSelect={() => {
                    onChange(unit.id === value ? "" : unit.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === unit.id ? "opacity-100" : "opacity-0")} />
                  {unit.nome_escola}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
