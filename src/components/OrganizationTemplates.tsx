import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Building2, Loader2, ChevronUp, ChevronDown, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EARNING_CATEGORIES, DEDUCTION_CATEGORIES } from "@/types/salary";
import { Separator } from "@/components/ui/separator";

interface Template {
  id: string;
  name: string;
  earnings: string[];
  deductions: string[];
}

interface OrganizationTemplatesProps {
  userId: string;
}

export const OrganizationTemplates = ({ userId }: OrganizationTemplatesProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [selectedEarnings, setSelectedEarnings] = useState<string[]>(["Basic Salary"]);
  const [selectedDeductions, setSelectedDeductions] = useState<string[]>(["Provident Fund (PF)"]);
  const [customEarning, setCustomEarning] = useState("");
  const [customDeduction, setCustomDeduction] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, [userId]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data: templatesData, error: templatesError } = await supabase
        .from("organization_templates")
        .select("*")
        .eq("user_id", userId)
        .order("name");

      if (templatesError) throw templatesError;

      if (!templatesData) {
        setTemplates([]);
        return;
      }

      const templatesWithDetails = await Promise.all(
        templatesData.map(async (template) => {
          const { data: earnings } = await supabase
            .from("template_earnings")
            .select("category")
            .eq("template_id", template.id)
            .order("created_at", { ascending: true });

          const { data: deductions } = await supabase
            .from("template_deductions")
            .select("category")
            .eq("template_id", template.id)
            .order("created_at", { ascending: true });

          return {
            id: template.id,
            name: template.name,
            earnings: earnings?.map((e) => e.category) || [],
            deductions: deductions?.map((d) => d.category) || [],
          };
        }),
      );

      setTemplates(templatesWithDetails);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    if (selectedEarnings.length === 0) {
      toast.error("Please select at least one earning category");
      return;
    }

    if (selectedDeductions.length === 0) {
      toast.error("Please select at least one deduction category");
      return;
    }

    setIsSaving(true);
    try {
      if (editingTemplate) {
        const { error: updateError } = await supabase
          .from("organization_templates")
          .update({ name: newTemplateName })
          .eq("id", editingTemplate.id);

        if (updateError) throw updateError;

        await supabase.from("template_earnings").delete().eq("template_id", editingTemplate.id);
        await supabase.from("template_deductions").delete().eq("template_id", editingTemplate.id);

        const earningsData = selectedEarnings.map((category) => ({
          template_id: editingTemplate.id,
          category,
        }));

        const deductionsData = selectedDeductions.map((category) => ({
          template_id: editingTemplate.id,
          category,
        }));

        await supabase.from("template_earnings").insert(earningsData);
        await supabase.from("template_deductions").insert(deductionsData);

        toast.success("Template updated successfully");
      } else {
        const { data: newTemplate, error: templateError } = await supabase
          .from("organization_templates")
          .insert({
            user_id: userId,
            name: newTemplateName,
          })
          .select()
          .single();

        if (templateError) throw templateError;

        const earningsData = selectedEarnings.map((category) => ({
          template_id: newTemplate.id,
          category,
        }));

        const deductionsData = selectedDeductions.map((category) => ({
          template_id: newTemplate.id,
          category,
        }));

        const { error: earningsError } = await supabase.from("template_earnings").insert(earningsData);
        if (earningsError) throw earningsError;

        const { error: deductionsError } = await supabase
          .from("template_deductions")
          .insert(deductionsData);
        if (deductionsError) throw deductionsError;

        toast.success("Template created successfully");
      }

      resetForm();
      fetchTemplates();
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast.error("Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setNewTemplateName(template.name);
    setSelectedEarnings(template.earnings);
    setSelectedDeductions(template.deductions);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("organization_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;

      toast.success("Template deleted successfully");
      fetchTemplates();
    } catch (error: any) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    }
  };

  const resetForm = () => {
    setEditingTemplate(null);
    setNewTemplateName("");
    setSelectedEarnings(["Basic Salary"]);
    setSelectedDeductions(["Provident Fund (PF)"]);
    setCustomEarning("");
    setCustomDeduction("");
  };

  const toggleEarning = (category: string) => {
    setSelectedEarnings((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  const toggleDeduction = (category: string) => {
    setSelectedDeductions((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  const handleMoveCategory = async (
    template: Template,
    category: string,
    from: "earnings" | "deductions",
  ) => {
    const direction = from === "earnings" ? "Earnings → Deductions" : "Deductions → Earnings";

    if (
      !confirm(
        `Move "${category}" from ${direction} for ${template.name}? This will also update existing salary records.`,
      )
    ) {
      return;
    }

    setIsSaving(true);

    try {
      // 1) Find all salary records for this user and organization
      const { data: salaryRecords, error: salaryError } = await supabase
        .from("salary_records")
        .select("id")
        .eq("user_id", userId)
        .eq("organization", template.name);

      if (salaryError) throw salaryError;

      const recordIds = salaryRecords?.map((r) => r.id) ?? [];

      if (recordIds.length > 0) {
        if (from === "earnings") {
          // Move from earnings → deductions
          const { data: earningRows, error: earningsError } = await supabase
            .from("earnings")
            .select("id, amount, description, salary_record_id")
            .in("salary_record_id", recordIds)
            .eq("category", category);

          if (earningsError) throw earningsError;

          if (earningRows && earningRows.length > 0) {
            const insertData = earningRows.map((row) => ({
              salary_record_id: row.salary_record_id,
              amount: row.amount,
              category,
              description: row.description,
            }));

            const { error: insertError } = await supabase.from("deductions").insert(insertData);
            if (insertError) throw insertError;

            const { error: deleteError } = await supabase
              .from("earnings")
              .delete()
              .in(
                "id",
                earningRows.map((row) => row.id),
              );

            if (deleteError) throw deleteError;
          }
        } else {
          // Move from deductions → earnings
          const { data: deductionRows, error: deductionsError } = await supabase
            .from("deductions")
            .select("id, amount, description, salary_record_id")
            .in("salary_record_id", recordIds)
            .eq("category", category);

          if (deductionsError) throw deductionsError;

          if (deductionRows && deductionRows.length > 0) {
            const insertData = deductionRows.map((row) => ({
              salary_record_id: row.salary_record_id,
              amount: row.amount,
              category,
              description: row.description,
            }));

            const { error: insertError } = await supabase.from("earnings").insert(insertData);
            if (insertError) throw insertError;

            const { error: deleteError } = await supabase
              .from("deductions")
              .delete()
              .in(
                "id",
                deductionRows.map((row) => row.id),
              );

            if (deleteError) throw deleteError;
          }
        }
      }

      // 2) Update template category tables
      if (from === "earnings") {
        const { error: deleteError } = await supabase
          .from("template_earnings")
          .delete()
          .eq("template_id", template.id)
          .eq("category", category);

        if (deleteError) throw deleteError;

        const { error: insertError } = await supabase.from("template_deductions").insert({
          template_id: template.id,
          category,
        });

        if (insertError) throw insertError;
      } else {
        const { error: deleteError } = await supabase
          .from("template_deductions")
          .delete()
          .eq("template_id", template.id)
          .eq("category", category);

        if (deleteError) throw deleteError;

        const { error: insertError } = await supabase.from("template_earnings").insert({
          template_id: template.id,
          category,
        });

        if (insertError) throw insertError;
      }

      toast.success("Category moved and salary data updated");

      // Refresh templates list so UI reflects latest state
      fetchTemplates();
    } catch (error: any) {
      console.error("Error moving category:", error);
      toast.error("Failed to move category");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReorderCategory = async (
    template: Template,
    type: "earnings" | "deductions",
    index: number,
    direction: "up" | "down",
  ) => {
    const list = type === "earnings" ? template.earnings : template.deductions;
    const newIndex = direction === "up" ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= list.length) return;

    const reordered = [...list];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);

    setIsSaving(true);

    try {
      if (type === "earnings") {
        await supabase.from("template_earnings").delete().eq("template_id", template.id);
        const earningsData = reordered.map((category) => ({
          template_id: template.id,
          category,
        }));
        const { error } = await supabase.from("template_earnings").insert(earningsData);
        if (error) throw error;
      } else {
        await supabase.from("template_deductions").delete().eq("template_id", template.id);
        const deductionsData = reordered.map((category) => ({
          template_id: template.id,
          category,
        }));
        const { error } = await supabase.from("template_deductions").insert(deductionsData);
        if (error) throw error;
      }

      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id
            ? {
                ...t,
                earnings: type === "earnings" ? reordered : t.earnings,
                deductions: type === "deductions" ? reordered : t.deductions,
              }
            : t,
        ),
      );

      toast.success("Template order updated");
    } catch (error: any) {
      console.error("Error reordering categories:", error);
      toast.error("Failed to reorder categories");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRenameCategory = async (
    template: Template,
    type: "earnings" | "deductions",
    oldName: string,
    newName: string,
  ) => {
    setIsSaving(true);
    try {
      // Update all salary data entries for this organization
      const { data: salaryRecords, error: salaryError } = await supabase
        .from("salary_records")
        .select("id")
        .eq("user_id", userId)
        .eq("organization", template.name);

      if (salaryError) throw salaryError;

      const recordIds = salaryRecords?.map((r) => r.id) ?? [];

      if (recordIds.length > 0) {
        const table = type === "earnings" ? "earnings" : "deductions";
        const { error: updateError } = await supabase
          .from(table)
          .update({ category: newName })
          .in("salary_record_id", recordIds)
          .eq("category", oldName);

        if (updateError) throw updateError;
      }

      // Update template category tables
      if (type === "earnings") {
        const { error } = await supabase
          .from("template_earnings")
          .update({ category: newName })
          .eq("template_id", template.id)
          .eq("category", oldName);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("template_deductions")
          .update({ category: newName })
          .eq("template_id", template.id)
          .eq("category", oldName);
        if (error) throw error;
      }

      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id
            ? {
                ...t,
                earnings:
                  type === "earnings"
                    ? t.earnings.map((c) => (c === oldName ? newName : c))
                    : t.earnings,
                deductions:
                  type === "deductions"
                    ? t.deductions.map((c) => (c === oldName ? newName : c))
                    : t.deductions,
              }
            : t,
        ),
      );

      toast.success("Category renamed successfully");
    } catch (error: any) {
      console.error("Error renaming category:", error);
      toast.error("Failed to rename category");
    } finally {
      setIsSaving(false);
    }
  };

  const DEFAULT_CARD_ORDER: Array<"form" | "list"> = ["form", "list"];
  const [cardOrder, setCardOrder] = useState<Array<"form" | "list">>(DEFAULT_CARD_ORDER);
  const [draggingId, setDraggingId] = useState<"form" | "list" | null>(null);

  const handleResetLayout = () => {
    setCardOrder(DEFAULT_CARD_ORDER);
  };

  const handleDragStart = (id: "form" | "list") => {
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (targetId: "form" | "list") => {
    if (!draggingId || draggingId === targetId) return;

    const currentIndex = cardOrder.indexOf(draggingId);
    const targetIndex = cardOrder.indexOf(targetId);
    if (currentIndex === -1 || targetIndex === -1) return;

    const newOrder = [...cardOrder];
    newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, draggingId);
    setCardOrder(newOrder);
    setDraggingId(null);
  };

  const isDefaultLayout = JSON.stringify(cardOrder) === JSON.stringify(DEFAULT_CARD_ORDER);

  const renderCard = (id: "form" | "list") => {
    if (id === "form") {
      return (
        <Card
          key="form"
          className={`border-primary/20 shadow-lg transition-shadow cursor-move ${
            draggingId === "form" ? "ring-2 ring-primary" : ""
          }`}
          draggable
          onDragStart={() => handleDragStart("form")}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop("form")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {editingTemplate ? "Edit Template" : "Create New Template"}
            </CardTitle>
            <CardDescription>Define salary structure for your organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Acme Corp"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold">Earnings Categories</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Add custom earning"
                    value={customEarning}
                    onChange={(e) => setCustomEarning(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      const val = customEarning.trim();
                      if (!val) return;
                      if (!selectedEarnings.includes(val)) {
                        setSelectedEarnings((prev) => [...prev, val]);
                      }
                      setCustomEarning("");
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto p-3 bg-muted/30 rounded-lg">
                  {EARNING_CATEGORIES.map((category) => (
                    <label
                      key={category}
                      className="flex items-center gap-2 p-2 hover:bg-background/50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEarnings.includes(category)}
                        onChange={() => toggleEarning(category)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{category}</span>
                    </label>
                  ))}
                  {selectedEarnings
                    .filter((c) => !EARNING_CATEGORIES.includes(c))
                    .map((category) => (
                      <label
                        key={category}
                        className="flex items-center gap-2 p-2 hover:bg-background/50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEarnings.includes(category)}
                          onChange={() => toggleEarning(category)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{category}</span>
                      </label>
                    ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">Deduction Categories</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Add custom deduction"
                    value={customDeduction}
                    onChange={(e) => setCustomDeduction(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      const val = customDeduction.trim();
                      if (!val) return;
                      if (!selectedDeductions.includes(val)) {
                        setSelectedDeductions((prev) => [...prev, val]);
                      }
                      setCustomDeduction("");
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto p-3 bg-muted/30 rounded-lg">
                  {DEDUCTION_CATEGORIES.map((category) => (
                    <label
                      key={category}
                      className="flex items-center gap-2 p-2 hover:bg-background/50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDeductions.includes(category)}
                        onChange={() => toggleDeduction(category)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{category}</span>
                    </label>
                  ))}
                  {selectedDeductions
                    .filter((c) => !DEDUCTION_CATEGORIES.includes(c))
                    .map((category) => (
                      <label
                        key={category}
                        className="flex items-center gap-2 p-2 hover:bg-background/50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDeductions.includes(category)}
                          onChange={() => toggleDeduction(category)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{category}</span>
                      </label>
                    ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleSaveTemplate} disabled={isSaving} type="button">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingTemplate ? "Update Template" : "Create Template"}
              </Button>
              {editingTemplate && (
                <Button variant="outline" onClick={resetForm} type="button">
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card
        key="list"
        className={`border-primary/20 shadow-lg transition-shadow cursor-move ${
          draggingId === "list" ? "ring-2 ring-primary" : ""
        }`}
        draggable
        onDragStart={() => handleDragStart("list")}
        onDragOver={handleDragOver}
        onDrop={() => handleDrop("list")}
      >
        <CardHeader>
          <CardTitle>Saved Templates</CardTitle>
          <CardDescription>Manage your organization salary templates</CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No templates yet. Create one to get started!
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => (
                <Card key={template.id} className="border-muted">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-primary" />
                          {template.name}
                        </h3>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => handleEditTemplate(template)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          type="button"
                          onClick={() => handleDeleteTemplate(template.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium mb-2">
                          Earnings ({template.earnings.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {template.earnings.map((earning, index) => (
                            <div key={earning} className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveCategory(template, earning, "earnings")}
                                className="text-xs px-2 py-1 bg-green-500/10 text-green-700 dark:text-green-300 rounded hover:bg-green-500/20 transition"
                                title="Click to move this to Deductions and update salary data"
                              >
                                {earning}
                              </button>
                              <button
                                type="button"
                                className="p-1 text-muted-foreground hover:text-foreground"
                                title="Rename earning"
                                onClick={() => {
                                  const next = prompt("Rename earning", earning)?.trim();
                                  if (!next || next === earning) return;
                                  handleRenameCategory(template, "earnings", earning, next);
                                }}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                                  onClick={() => handleReorderCategory(template, "earnings", index, "up")}
                                  disabled={index === 0}
                                  title="Move up"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                                  onClick={() => handleReorderCategory(template, "earnings", index, "down")}
                                  disabled={index === template.earnings.length - 1}
                                  title="Move down"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">
                          Deductions ({template.deductions.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {template.deductions.map((deduction, index) => (
                            <div key={deduction} className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveCategory(template, deduction, "deductions")}
                                className="text-xs px-2 py-1 bg-red-500/10 text-red-700 dark:text-red-300 rounded hover:bg-red-500/20 transition"
                                title="Click to move this to Earnings and update salary data"
                              >
                                {deduction}
                              </button>
                              <button
                                type="button"
                                className="p-1 text-muted-foreground hover:text-foreground"
                                title="Rename deduction"
                                onClick={() => {
                                  const next = prompt("Rename deduction", deduction)?.trim();
                                  if (!next || next === deduction) return;
                                  handleRenameCategory(template, "deductions", deduction, next);
                                }}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                                  onClick={() => handleReorderCategory(template, "deductions", index, "up")}
                                  disabled={index === 0}
                                  title="Move up"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                                  onClick={() => handleReorderCategory(template, "deductions", index, "down")}
                                  disabled={index === template.deductions.length - 1}
                                  title="Move down"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetLayout}
          disabled={isDefaultLayout}
        >
          Reset layout
        </Button>
      </div>
      <div className="space-y-6">
        {cardOrder.map((id) => (
          <div key={id}>{renderCard(id)}</div>
        ))}
      </div>
    </div>
  );
};
