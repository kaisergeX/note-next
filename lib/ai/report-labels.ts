import 'server-only'

import {hasLocale} from 'next-intl'
import {getTranslations} from 'next-intl/server'
import {localeRouting} from '../../i18n/routing'
import type {ReportLabels} from './export'

/**
 * Localizable label pack for the Markdown report builders (lib/ai/export.ts
 * stays pure — no next-intl import there). Export API routes live outside the
 * [locale] segment, so the locale arrives via the `?locale=` query param.
 * getTranslations({locale, namespace}) forwards the explicit locale into
 * i18n/request.ts, which loads the dictionary for that locale.
 */
export async function buildReportLabels(
  locale?: string | null,
): Promise<ReportLabels> {
  const resolved = hasLocale(localeRouting.locales, locale)
    ? locale
    : localeRouting.defaultLocale

  const tForm = await getTranslations({
    locale: resolved,
    namespace: 'ai.interview.form',
  })
  const tExp = await getTranslations({
    locale: resolved,
    namespace: 'ai.interview.export',
  })

  // Run-item status labels come from the run UI's own namespace (ai.interview.run) —
  // read-only: that namespace belongs to the run screens and is not touched.
  const tRun = await getTranslations({
    locale: resolved,
    namespace: 'ai.interview.run',
  })

  return {
    personaTitle: (name) => tExp('reportTitlePersona', {name}),
    sessionTitle: (name) => tExp('reportTitleSession', {name}),
    runTitle: (stamp) => tExp('reportTitleRun', {stamp}),
    sessionHeading: (n, title, stamp) =>
      tExp('sessionHeading', {n, title, stamp}),
    exportedLine: (stamp) => tExp('exportedAt', {stamp}),
    integrityLine: tExp('integrityLine'),
    participantProfile: tExp('participantProfile'),
    overview: tExp('overview'),
    researchContext: tExp('researchContext'),
    interviewScript: tExp('interviewScript'),
    participantsHeading: tExp('participantsHeading'),
    participantsCompleted: (done, total) =>
      tExp('participantsCompleted', {done, total}),
    sessions: tExp('sessions'),
    untitled: tExp('untitled'),
    noDialogue: tExp('noDialogue'),
    leaning: tExp('leaning'),
    genderUnspecified: tForm('genderUnspecified'),
    attrs: {
      region: tForm('region'),
      occupation: tForm('occupation'),
      gender: tForm('gender'),
      age: tForm('age'),
      income: tForm('income'),
      stance: tForm('stance'),
      tags: tForm('tags'),
      quirks: tForm('quirks'),
      bio: tForm('bio'),
    },
    options: {
      gender: {
        male: tForm('options.gender.male'),
        female: tForm('options.gender.female'),
      },
      income: {
        low: tForm('options.income.low'),
        medium: tForm('options.income.medium'),
        high: tForm('options.income.high'),
      },
      stance: {
        cooperative: tForm('options.stance.cooperative'),
        guarded: tForm('options.stance.guarded'),
        talkative: tForm('options.stance.talkative'),
        suspicious: tForm('options.stance.suspicious'),
      },
    },
    sliderPoles: {
      calm: tForm('sliderCalm'),
      anxious: tForm('sliderAnxious'),
      optimistic: tForm('sliderOptimistic'),
      cynical: tForm('sliderCynical'),
      frugal: tForm('sliderFrugal'),
      spendthrift: tForm('sliderSpendthrift'),
    },
    csv: {
      personaId: tExp('csvPersonaId'),
      personaName: tExp('csvPersonaName'),
      locale: tExp('csvLocale'),
      runId: tExp('csvRunId'),
      turnIndex: tExp('csvTurnIndex'),
      question: tExp('csvQuestion'),
      answer: tExp('csvAnswer'),
      questionTime: tExp('csvQuestionTime'),
      answerTime: tExp('csvAnswerTime'),
      questionIndex: tExp('csvQuestionIndex'),
    },
    runItemStatus: {
      pending: tRun('status.pending'),
      in_progress: tRun('status.in_progress'),
      done: tRun('status.done'),
      failed: tRun('status.failed'),
    },
    noTranscript: tExp('noTranscript'),
    noTranscriptError: (error) => tExp('noTranscriptError', {error}),
  }
}
