import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DepartmentComboboxProps {
  value: string;
  onChange: (value: string) => void;
}

export default function DepartmentCombobox({ value, onChange }: DepartmentComboboxProps) {
  const [open, setOpen] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase
      .from("departments")
      .select("id, name")
      .order("name")
      .then(({ data }) => setDepartments(data || []));
  }, []);

  const selectedLabel = departments.find((d) => d.id === value)?.name;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {selectedLabel || "Selecione um setor..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar setor..." />
          <CommandList>
            <CommandEmpty>Nenhum setor encontrado.</CommandEmpty>
            <CommandGroup>
              {departments.map((dept) => (
                <CommandItem
                  key={dept.id}
                  value={dept.name}
                  onSelect={() => {
                    onChange(dept.id === value ? "" : dept.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === dept.id ? "opacity-100" : "opacity-0")} />
                  {dept.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
