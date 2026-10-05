import { useEffect, useMemo, useState } from "react";
import { type Control, useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Help } from "@/components/guidance";
import { useClient } from "@/client/context";
import { ClientError, Conflict } from "@/client/port";
import type { components } from "@/api/gen/schema";
import { copy } from "@/copy";
import { ReferenceField } from "./ReferenceField";
import { ReferencePicker } from "./ReferencePicker";
import { fieldVocab, VocabOption } from "@/components/vocab";
import { type FieldDef, type SheetKind, slugify, unitHint } from "./schema";
import { DidYouMean } from "@/components/DidYouMean";

type Problem = components["schemas"]["Problem"];

export interface SheetRow {
  id: string;
  name: string;
  version: number;
  spec: Record<string, unknown>;
}

interface FormValues {
  _name: string;
  _id: string;
  _reason: string;
  [field: string]: unknown;
}

function defaultForField(f: FieldDef): unknown {
  switch (f.kind) {
    case "boolean":
      return false;
    case "ref-array":
    case "string-array":
      return [];
    case "integer":
    case "number":
      return undefined;
    default:
      return "";
  }
}

function fieldForPath(path: string, fields: FieldDef[]): string | null {
  if (path === "/metadata/id") return "_id";
  if (path === "/metadata/name" || path === "/spec/name") return "_name";
  for (const f of fields) {
    if (path === `/spec/${f.name}` || path.startsWith(`/spec/${f.name}/`)) return f.name;
  }
  return null;
}

/**
 * The Add / edit Dialog: one form generated from the kind's spec fields,
 * plus name, id and reason. Submit calls PUT (actor always "local", I3.2:
 * no actor picker anywhere); a 422 maps every problems[].path onto its
 * field, a 409 shows at the top.
 */
export function SheetForm({
  kind,
  kindLabel,
  fields,
  open,
  onOpenChange,
  existing,
  onSaved,
  initialName,
  minimal,
  preset,
}: {
  /** Only what the record requires: the name and the required fields, the
   * id taken from the name and the reason given, so adding one in passing
   * is a sentence and a choice or two (TAXONOMY.md D34). */
  minimal?: { reason: string };
  /** Values set on a new entry and not asked, such as a service's status. */
  preset?: Record<string, unknown>;
  /** A name to start a new entry from, as typed on the home page. */
  initialName?: string;
  kind: SheetKind | string;
  kindLabel: string;
  fields: FieldDef[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: SheetRow;
  /** Called with the saved entry's id and name, so a caller that opened
   * this dialog from inside another flow (a project section adding a data
   * source without leaving the page) can select what was just created. */
  onSaved?: (id: string, name: string) => void;
}) {
  const isEdit = !!existing;
  const queryClient = useQueryClient();
  const client = useClient();

  const [idEdited, setIdEdited] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const defaultValues = useMemo<FormValues>(() => {
    const base: FormValues = {
      _name: existing?.name ?? initialName ?? "",
      _id: existing?.id ?? "",
      _reason: minimal?.reason ?? "",
    };
    for (const f of fields) {
      const v = existing?.spec[f.name];
      base[f.name] = v ?? defaultForField(f);
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, fields, initialName]);

  const form = useForm<FormValues>({ defaultValues });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
      setIdEdited(false);
      setGeneralError(null);
      setConflict(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  const nameValue = form.watch("_name");
  useEffect(() => {
    if (!isEdit && !idEdited) {
      form.setValue("_id", slugify(typeof nameValue === "string" ? nameValue : ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameValue, isEdit, idEdited]);

  async function onSubmit(values: FormValues) {
    setGeneralError(null);
    setConflict(false);

    // The name is metadata.name alone (engine 2.6.0); spec carries none.
    const spec: Record<string, unknown> = { ...(isEdit ? {} : preset) };
    for (const f of fields) {
      const raw = values[f.name];
      const empty = raw === undefined || raw === "" || (Array.isArray(raw) && raw.length === 0);
      if (empty) {
        continue;
      }
      spec[f.name] = f.kind === "integer" || f.kind === "number" ? Number(raw) : raw;
    }

    const manifest = {
      apiVersion: "cartograph/v1",
      kind,
      metadata: { id: values._id, name: values._name },
      spec,
    };

    let refused: ClientError | undefined;
    try {
      await client.saveVersion(kind, values._id, manifest, values._reason);
    } catch (e) {
      if (!(e instanceof ClientError)) throw e;
      refused = e;
    }

    if (!refused) {
      queryClient.invalidateQueries({ queryKey: ["sheet-summaries", kind] });
      queryClient.invalidateQueries({ queryKey: ["sheet-ref-options", kind] });
      queryClient.invalidateQueries({ queryKey: ["sheet-row", kind, values._id] });
      onSaved?.(values._id, values._name);
      onOpenChange(false);
      return;
    }

    if (refused instanceof Conflict) {
      setConflict(true);
      return;
    }

    const problems: Problem[] = refused.problems;
    const unmatched: string[] = [];
    for (const p of problems) {
      const field = fieldForPath(p.path, fields);
      if (field) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form.setError(field as any, { type: "server", message: p.message });
      } else {
        unmatched.push(p.message);
      }
    }
    if (unmatched.length > 0) {
      setGeneralError(unmatched.join(" "));
    } else if (problems.length === 0) {
      setGeneralError(copy.sheets.dialog.generalError);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" data-cartograph-region="sheet-form">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `${copy.sheets.edit}: ${existing?.name}` : `${copy.sheets.add} ${kindLabel}`}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {copy.sheets.kindPurpose[kind] ? (
              <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{copy.sheets.kindPurpose[kind]}</p>
            ) : null}
            {conflict ? <p className="text-sm text-destructive">{copy.sheets.dialog.conflict}</p> : null}
            {generalError ? <p className="text-sm text-destructive">{generalError}</p> : null}

            <FormField
              control={form.control}
              name="_name"
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1">
                    <FormLabel>{copy.sheets.fields[kind]?.name ?? "Name"}</FormLabel>
                    <Help label={copy.sheets.fields[kind]?.name ?? "Name"} examples={copy.sheets.fieldExamples[kind]?.name ?? []} />
                  </div>
                  <FormControl>
                    <Input
                      {...field}
                      data-cartograph-field="/metadata/name"
                      value={field.value as string}
                      placeholder={copy.sheets.fieldPlaceholders[kind]?.name}
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                  {/* Adding one already there under another spelling: the
                      one there is handed back, as a save would. */}
                  {isEdit ? null : (
                    <DidYouMean
                      kind={kind}
                      name={field.value as string}
                      onUse={(m) => {
                        onSaved?.(m.id, m.name);
                        onOpenChange(false);
                      }}
                    />
                  )}
                </FormItem>
              )}
            />

            {minimal ? null : (
            <FormField
              control={form.control}
              name="_id"
              rules={{ required: true, pattern: /^[a-z0-9][a-z0-9-]{1,63}$/ }}
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1">
                    <FormLabel>{copy.sheets.dialog.idLabel}</FormLabel>
                    <Help label={copy.sheets.dialog.idLabel} hint={copy.sheets.dialog.idHint} />
                  </div>
                  <FormControl>
                    <Input
                      {...field}
                      data-cartograph-field="/metadata/id"
                      value={field.value as string}
                      disabled={isEdit}
                      onChange={(e) => {
                        setIdEdited(true);
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            )}

            {(minimal ? fields.filter((f) => f.required && !(preset && f.name in preset)) : fields).map((f) => (
              <SheetFormField key={f.name} kind={kind} field={f} control={form.control} />
            ))}

            {minimal ? null : (
            <FormField
              control={form.control}
              name="_reason"
              rules={{ required: true, maxLength: 60 }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{copy.sheets.dialog.reasonLabel}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value as string}
                      maxLength={60}
                      placeholder={copy.sheets.dialog.reasonPlaceholder}
                    />
                  </FormControl>
                  <FormDescription>{((field.value as string)?.length ?? 0)}/60</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {copy.sheets.dialog.cancel}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {copy.sheets.dialog.save}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SheetFormField({
  kind,
  field,
  control,
}: {
  kind: SheetKind | string;
  field: FieldDef;
  control: Control<FormValues>;
}) {
  const label = copy.sheets.fields[kind]?.[field.name] ?? field.name;
  // The field's place in the manifest: every sheet field sits on the spec.
  const pointer = `/spec/${field.name}`;
  // unitHint is the numeric unit ("months", "days"); fieldHints is the
  // line saying what belongs in the field at all. A numeric field can
  // carry both.
  const hint = [copy.sheets.fieldHints[kind]?.[field.name], unitHint(field.name)].filter(Boolean).join(" ");
  const placeholder = copy.sheets.fieldPlaceholders[kind]?.[field.name];
  const examples = copy.sheets.fieldExamples[kind]?.[field.name] ?? [];

  const heading = (
    <div className="flex items-center gap-1">
      <FormLabel>
        {label}
        {field.required ? " *" : ""}
      </FormLabel>
      <Help label={label} hint={hint} examples={examples} />
    </div>
  );
  // The contract's own value is never shown raw: "personRole" reads as a
  // role, "3" as quarterly, each beside its mark (design rules 7 and 12).
  const vocab = fieldVocab(kind, field.name);
  const rules = {
    required: field.required,
    ...(field.kind === "string" && field.maxLength ? { maxLength: field.maxLength } : {}),
  };

  if (field.kind === "ref" || field.kind === "ref-array") {
    return (
      <FormField
        control={control}
        name={field.name}
        rules={rules}
        render={({ field: rhf }) => (
          <FormItem>
            {heading}
            {field.kind === "ref" ? (
              // The picker, not the bare field: a dialog that asks for a
              // team must be able to make one. Without this, a required
              // reference to a directory that lacks the entry (DataSource
              // needs a team) is a dead end, since a combobox only selects
              // what already exists and typing a new name does nothing.
              <ReferencePicker
                refKind={field.refKind as string}
                data-cartograph-field={pointer}
                value={rhf.value as string | undefined}
                onChange={rhf.onChange}
              />
            ) : (
              <ReferenceField
                refKind={field.refKind as string}
                multiple
                data-cartograph-field={pointer}
                value={rhf.value as string | string[] | undefined}
                onChange={rhf.onChange}
              />
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  if (field.kind === "enum") {
    return (
      <FormField
        control={control}
        name={field.name}
        rules={rules}
        render={({ field: rhf }) => (
          <FormItem>
            {heading}
            <Select value={(rhf.value as string) ?? ""} onValueChange={rhf.onChange}>
              <FormControl>
                <SelectTrigger className="w-full" data-cartograph-field={pointer}>
                  <SelectValue placeholder={label} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {(field.enumValues ?? []).map((v) => (
                  <SelectItem key={String(v)} value={v}>
                    {vocab ? (
                      <VocabOption vocab={vocab} value={v as string | number} />
                    ) : (
                      // A choice with no mark still reads in words.
                      (copy.sheets.fieldValues[kind]?.[field.name]?.[String(v)] ?? String(v))
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  if (field.kind === "boolean") {
    return (
      <FormField
        control={control}
        name={field.name}
        render={({ field: rhf }) => (
          <FormItem className="flex flex-row items-center gap-2">
            <FormControl>
              <Checkbox data-cartograph-field={pointer} checked={!!rhf.value} onCheckedChange={rhf.onChange} />
            </FormControl>
            <FormLabel className="font-normal">{label}</FormLabel>
          </FormItem>
        )}
      />
    );
  }

  if (field.kind === "integer" || field.kind === "number") {
    return (
      <FormField
        control={control}
        name={field.name}
        rules={rules}
        render={({ field: rhf }) => (
          <FormItem>
            {heading}
            <FormControl>
              <Input
                type="number"
                data-cartograph-field={pointer}
                min={field.minimum}
                max={field.maximum}
                placeholder={placeholder}
                value={(rhf.value as number | undefined) ?? ""}
                onChange={(e) => rhf.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  return (
    <FormField
      control={control}
      name={field.name}
      rules={rules}
      render={({ field: rhf }) => (
        <FormItem>
          {heading}
          <FormControl>
            <Input
              {...rhf}
              data-cartograph-field={pointer}
              value={(rhf.value as string) ?? ""}
              placeholder={placeholder}
              maxLength={field.maxLength}
            />
          </FormControl>
          {field.maxLength ? (
            <FormDescription>
              {((rhf.value as string)?.length ?? 0)}/{field.maxLength}
            </FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
