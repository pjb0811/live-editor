import { useEffect, useMemo } from 'react';

import type { Section } from '~/types';
import { extract } from '~/utils/ast/extract';
import { fillIdsFrom } from '~/utils/ast/tree';
import { type BindingOptions, type DataAttrNode } from '~/utils/ast/types';
import { updateAll } from '~/utils/ast/update';

import { type LiveMessages } from '../../context/messages';
import type { DndEditError } from '../edit-options';
import {
  type PanelBinding,
  type PanelNodeChange,
  resolvePanelBindings,
  withPanelCommit,
} from '../panel-binding';
import {
  type ReportLatest,
  blockedEditError,
  describeUpdateFailure,
} from './edit-errors';
import type { useSectionDocument } from './use-section-document';

type SectionDocument = ReturnType<typeof useSectionDocument>;

interface Options {
  selectedSection: SectionDocument['selectedSection'];
  stale: SectionDocument['stale'];
  problem: SectionDocument['problem'];
  // The container id the document is missing, or `null`.
  missingContainer: string | null;
  getCommittedSection: SectionDocument['getCommittedSection'];
  onChange: (next: Partial<Section>) => void;
  bindingOptions: BindingOptions;
  reportError: (error: DndEditError) => void;
  messages: LiveMessages;
  reportLatest: ReportLatest;
}

// What the panel edits: the selected section's bound elements as
// `bindings`, and the one path that turns a panel edit into a new section
// source. Also reports what keeps the document from being edited, a missing
// container or a section that doesn't parse.
export const useSectionEditing = ({
  selectedSection,
  stale,
  problem,
  missingContainer,
  getCommittedSection,
  onChange,
  bindingOptions,
  reportError,
  messages,
  reportLatest,
}: Options) => {
  // The selected section's elements, parsed again only when its code or id
  // changes.
  const selectedCode = selectedSection?.code;
  const selectedSectionId = selectedSection?.id;
  const { fields, updatedCode, parseError } = useMemo(() => {
    if (!selectedCode) {
      return {
        fields: [] as DataAttrNode[],
        updatedCode: '',
        parseError: null,
      };
    }

    try {
      // The same ids the canvas preview fills this section with, so an
      // element's `data-id` there matches its fields here (#432).
      const updated = fillIdsFrom(selectedCode, selectedSectionId ?? '');
      // Every element, the `<section>` itself included, so a binding on the
      // section is editable too (#429).
      const allNodes = extract(updated, bindingOptions);

      return {
        fields: allNodes,
        updatedCode: updated !== selectedCode ? updated : selectedCode,
        parseError: null,
      };
    } catch (e) {
      console.warn('⚠️ Parsing error', e);
      return {
        fields: [] as DataAttrNode[],
        updatedCode: '',
        parseError: { error: e },
      };
    }
  }, [selectedCode, selectedSectionId, bindingOptions]);

  // Keyed on the missing id alone, so it fires when a document reaches this
  // state and not again for every edit that leaves it there.
  useEffect(() => {
    if (missingContainer !== null) {
      reportLatest(m => ({
        type: 'parse',
        target: 'document',
        reason: 'container-not-found',
        containerId: missingContainer,
        title: m.editErrors.missingContainer(missingContainer),
        description: m.editErrors.missingContainerDetail(missingContainer),
      }));
    }
  }, [missingContainer, reportLatest]);

  useEffect(() => {
    if (parseError) {
      reportLatest(m => ({
        type: 'parse',
        target: 'section',
        error: parseError.error,
        title: m.editErrors.sectionParseFailed,
        description: m.editErrors.checkConsole,
      }));
    }
  }, [parseError, reportLatest]);

  // The one commit path for panel edits. A single edit is a batch of one
  // (#425).
  const commitChanges = (changes: Parameters<PanelNodeChange>[0][]) => {
    if (changes.length === 0) {
      return;
    }

    // The fields show the last version that parsed while the source doesn't,
    // and their ids point into that version, not the current source (#433).
    if (stale && problem?.reason === 'parse-error') {
      reportError(blockedEditError(problem.error, messages));
      return;
    }

    // If an earlier commit in this same tick changed this section, build on
    // its result: starting from this render's `updatedCode` would undo it
    // (#450). Otherwise use `updatedCode`, which has the filled ids the
    // bindings point at.
    const committed =
      selectedSection && getCommittedSection(selectedSection.id)?.code;
    const base =
      committed && committed !== selectedCode ? committed : updatedCode;
    const result = updateAll(
      base,
      changes.map(({ id, label, property, value: changeValue }) => ({
        dataId: id,
        label,
        property,
        value: changeValue,
      })),
      bindingOptions,
    );

    if (!result.success) {
      const { id, label, property } = changes[result.index]!;

      reportError({
        type: 'update',
        id,
        label,
        property,
        failure: result.failure,
        ...describeUpdateFailure(result.failure, label, messages),
      });
      return;
    }

    if (selectedSection) {
      onChange({ ...selectedSection, code: result.code });
    }
  };

  const onFieldChange: PanelNodeChange = change => commitChanges([change]);

  // One entry per bound property, from `fields` alone. Don't add `onChange`
  // here: a callback must come from the current render, and this memo can
  // outlive it (#336).
  const bindingFields = useMemo(
    () => fields.flatMap(node => resolvePanelBindings(node)?.bindings ?? []),
    [fields],
  );

  // Adds each binding's `onChange`, made fresh every render so a commit uses
  // the current section and code. It's a cheap walk with no parsing.
  const bindings: PanelBinding[] = withPanelCommit(
    bindingFields,
    onFieldChange,
  );

  return { bindings, onFieldChange, commitChanges };
};
