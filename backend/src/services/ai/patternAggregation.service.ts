import { IQuestion, IAIAnalysis } from '../../types/question.types.js';

export interface IConceptCount {
  concept: string;
  count: number;
}

export interface ISubjectConceptMap {
  [subject: string]: IConceptCount[];
}

export interface IDistributionItem {
  key: string;
  count: number;
  percentage: number;
}

export interface IQuestionPatternItem {
  questionId: string;
  subject: string;
  topic: string;
  questionPattern: string;
  solutionApproach: string;
  cognitiveSkill: string;
  difficultyAssessment: string;
  reasoningType: string[];
}

export interface ICommonTrapItem {
  questionId: string;
  subject: string;
  trap: string;
}

export interface IPatternAggregationSummary {
  totalQuestions: number;
  analyzedQuestions: number;
  unanalyzedQuestions: number;
  coveragePercentage: number;
  conceptFrequencies: {
    topGlobal: IConceptCount[];
    bySubject: ISubjectConceptMap;
  };
  subConceptFrequencies: IConceptCount[];
  reasoningTypeDistribution: IDistributionItem[];
  cognitiveSkillDistribution: IDistributionItem[];
  difficultyDistribution: {
    aiAssessed: { [key: string]: number };
    humanAssigned: { [key: string]: number };
  };
  commonQuestionPatterns: IQuestionPatternItem[];
  commonTraps: ICommonTrapItem[];
  distractorPatterns: string[];
  gateCharacteristics: IConceptCount[];
}

export class PatternAggregationService {
  /**
   * Performs in-memory aggregate analysis across all questions in the database.
   */
  public aggregatePatterns(
    allQuestions: IQuestion[],
    options?: { excludeGA?: boolean }
  ): IPatternAggregationSummary {
    let questions = allQuestions;
    if (options?.excludeGA) {
      questions = questions.filter(
        (q) =>
          (q.subject || '').toLowerCase() !== 'general aptitude' &&
          q.source?.section !== 'GA'
      );
    }
    const totalQuestions = questions.length;
    const analyzedList = questions.filter((q) => q.aiAnalysis && q.aiAnalysis.analyzed);
    const analyzedQuestions = analyzedList.length;
    const unanalyzedQuestions = totalQuestions - analyzedQuestions;
    const coveragePercentage = totalQuestions > 0 ? Math.round((analyzedQuestions / totalQuestions) * 100) : 0;

    // Concept frequencies
    const globalConceptMap = new Map<string, number>();
    const subjectConceptMap = new Map<string, Map<string, number>>();
    const subConceptMap = new Map<string, number>();
    const reasoningMap = new Map<string, number>();
    const cognitiveMap = new Map<string, number>();
    const aiDiffMap = { Easy: 0, Medium: 0, Hard: 0 };
    const humanDiffMap = { Easy: 0, Medium: 0, Hard: 0 };
    const gateCharMap = new Map<string, number>();
    const patternsList: IQuestionPatternItem[] = [];
    const trapsList: ICommonTrapItem[] = [];
    const distractorsList: string[] = [];

    // Human assigned difficulty from all questions
    for (const q of allQuestions) {
      if (q.difficulty && humanDiffMap[q.difficulty] !== undefined) {
        humanDiffMap[q.difficulty]++;
      }
    }

    // AI Analysis aggregation
    for (const q of analyzedList) {
      const a = q.aiAnalysis as IAIAnalysis;
      const subj = q.subject || 'General';

      // Concepts
      if (!subjectConceptMap.has(subj)) {
        subjectConceptMap.set(subj, new Map<string, number>());
      }
      const sMap = subjectConceptMap.get(subj)!;

      for (const c of a.concepts || []) {
        const norm = c.trim();
        if (norm) {
          globalConceptMap.set(norm, (globalConceptMap.get(norm) || 0) + 1);
          sMap.set(norm, (sMap.get(norm) || 0) + 1);
        }
      }

      // Sub-concepts
      for (const sc of a.subConcepts || []) {
        const norm = sc.trim();
        if (norm) {
          subConceptMap.set(norm, (subConceptMap.get(norm) || 0) + 1);
        }
      }

      // Reasoning Types
      for (const r of a.reasoningType || []) {
        const norm = r.toLowerCase().trim();
        if (norm) {
          reasoningMap.set(norm, (reasoningMap.get(norm) || 0) + 1);
        }
      }

      // Cognitive Skill
      if (a.cognitiveSkill) {
        const norm = a.cognitiveSkill.toLowerCase().trim();
        cognitiveMap.set(norm, (cognitiveMap.get(norm) || 0) + 1);
      }

      // AI Difficulty
      if (a.difficultyAssessment && aiDiffMap[a.difficultyAssessment] !== undefined) {
        aiDiffMap[a.difficultyAssessment]++;
      }

      // Question Patterns
      if (a.questionPattern) {
        patternsList.push({
          questionId: q.id,
          subject: q.subject || '',
          topic: q.topic || '',
          questionPattern: a.questionPattern,
          solutionApproach: a.solutionApproach || '',
          cognitiveSkill: a.cognitiveSkill || 'understand',
          difficultyAssessment: a.difficultyAssessment || q.difficulty || 'Medium',
          reasoningType: a.reasoningType || [],
        });
      }

      // Traps
      for (const t of a.commonTraps || []) {
        if (t.trim()) {
          trapsList.push({
            questionId: q.id,
            subject: q.subject || '',
            trap: t.trim(),
          });
        }
      }

      // Distractors
      for (const d of a.distractorPatterns || []) {
        if (d.trim()) {
          distractorsList.push(d.trim());
        }
      }

      // GATE Characteristics
      for (const gc of a.gateCharacteristics || []) {
        const norm = gc.trim();
        if (norm) {
          gateCharMap.set(norm, (gateCharMap.get(norm) || 0) + 1);
        }
      }
    }

    const sortMapToCounts = (map: Map<string, number>): IConceptCount[] =>
      Array.from(map.entries())
        .map(([concept, count]) => ({ concept, count }))
        .sort((a, b) => b.count - a.count);

    const totalReasoningTags = Array.from(reasoningMap.values()).reduce((sum, v) => sum + v, 0);
    const reasoningDistribution: IDistributionItem[] = Array.from(reasoningMap.entries())
      .map(([key, count]) => ({
        key,
        count,
        percentage: totalReasoningTags > 0 ? Math.round((count / totalReasoningTags) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const totalCognitiveTags = Array.from(cognitiveMap.values()).reduce((sum, v) => sum + v, 0);
    const cognitiveDistribution: IDistributionItem[] = Array.from(cognitiveMap.entries())
      .map(([key, count]) => ({
        key,
        count,
        percentage: totalCognitiveTags > 0 ? Math.round((count / totalCognitiveTags) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const bySubjectMap: ISubjectConceptMap = {};
    for (const [subj, map] of subjectConceptMap.entries()) {
      bySubjectMap[subj] = sortMapToCounts(map);
    }

    return {
      totalQuestions,
      analyzedQuestions,
      unanalyzedQuestions,
      coveragePercentage,
      conceptFrequencies: {
        topGlobal: sortMapToCounts(globalConceptMap),
        bySubject: bySubjectMap,
      },
      subConceptFrequencies: sortMapToCounts(subConceptMap),
      reasoningTypeDistribution: reasoningDistribution,
      cognitiveSkillDistribution: cognitiveDistribution,
      difficultyDistribution: {
        aiAssessed: aiDiffMap,
        humanAssigned: humanDiffMap,
      },
      commonQuestionPatterns: patternsList,
      commonTraps: trapsList,
      distractorPatterns: distractorsList,
      gateCharacteristics: sortMapToCounts(gateCharMap),
    };
  }
}

export const patternAggregationService = new PatternAggregationService();
