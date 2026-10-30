"use client";

import { useState, useTransition } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { deleteCategory, saveCategory, setCategoryArchived, type CategoryInput } from "@/actions/categories";
import { addMissingDefaultCategory, addSuggestedSubcategories, removeSubcategory, saveSubcategory, setSubcategoryArchived } from "@/actions/subcategories";
import { CATEGORY_ICONS, DEFAULT_SUBCATEGORIES } from "@/lib/defaults";
import type { Group } from "@/lib/calc";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input, Toggle } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Bits";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

export interface ManagedSub {
  id: string;
  name: string;
  archived: boolean;
  uses: number;
}

export interface ManagedCategory {
  id: string;
  name: string;
  icon: string;
  kind: "expense" | "income";
  group: Group;
  isFixed: boolean;
  rollover: boolean;
  archived: boolean;
  uses: number;
  subs: ManagedSub[];
}

const GROUP_LABEL: Record<Group, string> = { need: "Needs", want: "Wants", savings: "Savings", business: "Business", income: "Income" };
const GROUP_ORDER: Group[] = ["need", "want", "savings", "business", "income"];
const OPTIONAL_DEFAULTS = ["Tithe", "Business", "Business Income"];

export function CategoriesManager({ categories }: { categories: ManagedCategory[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<ManagedCategory | null | "new">(null);
  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);
  const canSuggest = categories.some((c) => DEFAULT_SUBCATEGORIES[c.name] && c.subs.length === 0);
  const missingDefaults = OPTIONAL_DEFAULTS.filter((n) => !categories.some((c) => c.name === n));

  return (
    <div className="space-y-4">
      <p className="px-1 text-sm text-ink-2">
        Needs / Wants / Savings decide the 50/30/20 check; Business is tracked apart from it. <strong className="font-semibold">Fixed</strong> bills don&apos;t count toward Safe to spend; <strong className="font-semibold">rollover</strong> carries leftovers forward. Open a category to manage its subcategories.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setEditing("new")}>
          <Plus size={18} /> New category
        </Button>
        {canSuggest && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await addSuggestedSubcategories();
                toast(res.ok ? { message: `Added ${res.added} suggested subcategories` } : { message: res.error, tone: "error" });
              })
            }
          >
            <Sparkles size={18} /> Add suggested subcategories
          </Button>
        )}
        {missingDefaults.map((n) => (
          <Button
            key={n}
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await addMissingDefaultCategory(n);
                toast(res.ok ? { message: `${n} added` } : { message: res.error, tone: "error" });
              })
            }
          >
            <Plus size={16} /> Add {n}
          </Button>
        ))}
      </div>

      {GROUP_ORDER.map((g) => {
        const rows = active.filter((c) => c.group === g);
        if (rows.length === 0) return null;
        return (
          <section key={g}>
            <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-3">{GROUP_LABEL[g]}</h2>
            <ul className="divide-y divide-line rounded-card bg-card shadow-card">
              {rows.map((c) => {
                const liveSubs = c.subs.filter((s) => !s.archived);
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => setEditing(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-card-2/60">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card-2 text-ink-2">
                        <Icon name={c.icon} size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{c.name}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {c.uses} entr{c.uses === 1 ? "y" : "ies"}
                          {liveSubs.length > 0 && ` · ${liveSubs.map((s) => s.name).join(", ")}`}
                        </span>
                      </span>
                      <span className="flex gap-1">
                        {c.isFixed && <Pill>fixed</Pill>}
                        {c.rollover && <Pill tone="green">rollover</Pill>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {archived.length > 0 && (
        <details className="px-1 text-sm text-ink-3">
          <summary className="cursor-pointer py-2 font-medium">Archived ({archived.length})</summary>
          <ul className="mt-2 divide-y divide-line rounded-card bg-card shadow-card">
            {archived.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setEditing(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <Icon name={c.icon} size={18} className="text-ink-3" />
                  <span className="flex-1 text-ink-2">{c.name}</span>
                  <span className="text-xs">{GROUP_LABEL[c.group]}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {editing !== null && <CategorySheet onClose={() => setEditing(null)} category={editing === "new" ? null : editing} />}
    </div>
  );
}

function CategorySheet({ onClose, category }: { onClose: () => void; category: ManagedCategory | null }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<CategoryInput>(() =>
    category
      ? { id: category.id, name: category.name, icon: category.icon, kind: category.kind, group: category.group, isFixed: category.isFixed, rollover: category.rollover }
      : { name: "", icon: "Tag", kind: "expense", group: "want", isFixed: false, rollover: false },
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof CategoryInput>(k: K, v: CategoryInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Sheet
      open
      onClose={onClose}
      title={category ? "Edit category" : "New category"}
      footer={
        <div className="flex gap-2">
          {category && (
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                if (category.uses > 0) {
                  start(async () => {
                    const res = await setCategoryArchived(category.id, !category.archived);
                    if (!res.ok) return setError(res.error);
                    onClose();
                    toast({ message: category.archived ? "Category restored" : "Category archived" });
                  });
                  return;
                }
                if (!confirmDelete) return setConfirmDelete(true);
                start(async () => {
                  const res = await deleteCategory(category.id);
                  if (!res.ok) return setError(res.error);
                  onClose();
                  toast({ message: "Category deleted" });
                });
              }}
            >
              {category.uses > 0 ? (category.archived ? "Restore" : "Archive") : confirmDelete ? "Really delete?" : "Delete"}
            </Button>
          )}
          <Button
            className="flex-1"
            size="lg"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await saveCategory(form);
                if (!res.ok) return setError(res.error);
                onClose();
                toast({ message: category ? "Category updated" : "Category created" });
              })
            }
          >
            {category ? "Save changes" : "Create category"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-2 pt-1">
        <Field label="Name">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={40} placeholder="Coffee, Daycare, Hobbies…" />
        </Field>
        <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 rounded-2xl bg-card-2 p-1">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={form.kind === k}
              onClick={() => {
                set("kind", k);
                set("group", k === "income" ? "income" : form.group === "income" ? "want" : form.group);
              }}
              className={`h-9 rounded-xl text-sm font-medium capitalize ${form.kind === k ? "bg-card shadow-sm" : "text-ink-2"}`}
            >
              {k}
            </button>
          ))}
        </div>
        {form.kind === "expense" && (
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Bucket</span>
            <div role="radiogroup" className="grid grid-cols-4 gap-2">
              {(["need", "want", "savings", "business"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={form.group === g}
                  onClick={() => set("group", g)}
                  className={`h-10 rounded-xl border text-sm font-medium ${form.group === g ? "border-green bg-green-soft text-green-text" : "border-line text-ink-2"}`}
                >
                  {GROUP_LABEL[g]}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Icon</span>
          <div className="grid grid-cols-8 gap-1.5">
            {CATEGORY_ICONS.map((i) => (
              <button
                key={i}
                type="button"
                aria-label={i}
                aria-pressed={form.icon === i}
                onClick={() => set("icon", i)}
                className={`flex aspect-square items-center justify-center rounded-xl ${form.icon === i ? "bg-green-soft text-green-text ring-2 ring-green" : "bg-card-2 text-ink-2"}`}
              >
                <Icon name={i} size={18} />
              </button>
            ))}
          </div>
        </div>
        {form.kind === "expense" && (
          <div className="divide-y divide-line rounded-2xl border border-line px-4">
            <Toggle checked={form.isFixed} onChange={(v) => set("isFixed", v)} label="Fixed bill" description="Same amount most months (rent, insurance). Not counted in Safe to spend." />
            <Toggle checked={form.rollover} onChange={(v) => set("rollover", v)} label="Roll over leftovers" description="Unspent money carries into next month, like a sinking fund." />
          </div>
        )}

        {category ? (
          <SubcategoryEditor category={category} />
        ) : (
          <p className="text-xs text-ink-3">Create the category first, then open it again to add subcategories (which car, which child, which card…).</p>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

function SubcategoryEditor({ category }: { category: ManagedCategory }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState("");
  const live = category.subs.filter((s) => !s.archived);
  const archived = category.subs.filter((s) => s.archived);

  function add() {
    const name = draft.trim();
    if (!name) return;
    start(async () => {
      const res = await saveSubcategory({ categoryId: category.id, name });
      if (!res.ok) return toast({ message: res.error, tone: "error" });
      setDraft("");
    });
  }

  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Subcategories</span>
      <p className="mb-2 text-xs text-ink-3">Optional detail when logging: the car you filled up, the child, the credit card, the kind of groceries. Tap a name to rename it.</p>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {live.map((s) => (
          <SubRow key={s.id} sub={s} categoryId={category.id} />
        ))}
        <li className="flex items-center gap-2 px-3 py-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            placeholder={live.length ? "Add another…" : "e.g. Honda, Emma, Visa…"}
            className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-1 text-[15px] placeholder:text-ink-3 focus:outline-none"
            maxLength={40}
          />
          <Button size="sm" variant="secondary" disabled={pending || !draft.trim()} onClick={add}>
            <Plus size={16} /> Add
          </Button>
        </li>
      </ul>
      {archived.length > 0 && (
        <details className="mt-2 text-xs text-ink-3">
          <summary className="cursor-pointer py-1">Archived subcategories ({archived.length})</summary>
          <ul className="mt-1 space-y-1">
            {archived.map((s) => (
              <li key={s.id} className="flex items-center justify-between">
                <span>{s.name}</span>
                <button
                  type="button"
                  className="font-medium text-green-text"
                  onClick={() => start(async () => void (await setSubcategoryArchived(s.id, false)))}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function SubRow({ sub, categoryId }: { sub: ManagedSub; categoryId: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(sub.name);

  function commit() {
    const next = name.trim();
    if (!next || next === sub.name) return setName(sub.name);
    start(async () => {
      const res = await saveSubcategory({ id: sub.id, categoryId, name: next });
      if (!res.ok) {
        setName(sub.name);
        toast({ message: res.error, tone: "error" });
      }
    });
  }

  return (
    <li className="flex items-center gap-2 px-3 py-1.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        aria-label={`Rename ${sub.name}`}
        className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-1 text-[15px] focus:bg-card-2 focus:outline-none"
        maxLength={40}
      />
      <span className="text-xs text-ink-3">{sub.uses > 0 ? `${sub.uses}` : ""}</span>
      <button
        type="button"
        disabled={pending}
        aria-label={`Remove ${sub.name}`}
        title={sub.uses > 0 ? "Archive (keeps history)" : "Delete"}
        onClick={() =>
          start(async () => {
            const res = await removeSubcategory(sub.id);
            toast(res.ok ? { message: sub.uses > 0 ? `${sub.name} archived` : `${sub.name} removed` } : { message: res.error, tone: "error" });
          })
        }
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 hover:bg-over-soft hover:text-over"
      >
        <X size={16} />
      </button>
    </li>
  );
}
