import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MultiDepartmentComboboxProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export default function MultiDepartmentCombobox({ value, onChange }: MultiDepartmentComboboxProps) {
  const [open, setOpen] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase
      .from("departments")
      .select("id, name")
      .order("name")
      .then(({ data }) => setDepartments(data || []));
  }, []);

  const handleSelect = (deptId: string) => {
    if (value.includes(deptId)) {
      onChange(value.filter(id => id !== deptId));
    } else {
      onChange([...value, deptId]);
    }
  };

  const selectedDepts = departments.filter(d => value.includes(d.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal h-auto min-h-[40px] px-3 py-2">
          {selectedDepts.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedDepts.map(d => (
                <Badge variant="secondary" key={d.id} className="mr-1 mb-1">
                  {d.name}
                </Badge>
              ))}
            </div>
          ) : (
            "Selecione um ou mais setores..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar setor..." />
          <CommandList>
            <CommandEmpty>Nenhum setor encontrado.</CommandEmpty>
            <CommandGroup>
              {departments.map((dept) => {
                const isSelected = value.includes(dept.id);
                return (
                  <CommandItem
                    key={dept.id}
                    value={dept.name}
                    onSelect={() => handleSelect(dept.id)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    {dept.name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
