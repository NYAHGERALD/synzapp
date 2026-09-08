import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Alert, Platform, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { ApprovedEmployee, TenantAiFeatureCatalogItem, TenantAiUsageDashboard, TenantAiUsageSummary, TenantDepartment } from '../../services/adminApi';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { AppSwitch } from '../ui/AppSwitch';

/**
 * AI usage and credits settings.
 *
 * Not chat code. Lifted out of the chat screen unchanged.
 */

export function AiUsageCreditsSettings({
  dashboard,
  departments,
  employees,
  features,
  isLoading,
  isSaving,
  onRefresh,
  onSaveBudget,
  onToggleCompany,
  onToggleDepartment,
  onToggleEmployee,
  onToggleFeature
}: {
  dashboard: TenantAiUsageDashboard | null;
  departments: TenantDepartment[];
  employees: ApprovedEmployee[];
  features: TenantAiFeatureCatalogItem[];
  isLoading: boolean;
  isSaving: boolean;
  onRefresh: () => void;
  onSaveBudget: (monthlyBudgetUsd: number | null, hardLimitEnabled: boolean) => void;
  onToggleCompany: (enabled: boolean) => void;
  onToggleDepartment: (department: TenantDepartment, enabled: boolean) => void;
  onToggleEmployee: (employee: ApprovedEmployee, enabled: boolean) => void;
  onToggleFeature: (feature: TenantAiFeatureCatalogItem, enabled: boolean) => void;
}) {
  const appTheme = useAppTheme();
  const policy = dashboard?.policy || null;
  const summary = dashboard?.summary || null;
  const [budgetDraft, setBudgetDraft] = useState('');

  useEffect(() => {
    setBudgetDraft(policy?.monthlyBudgetUsd === null || policy?.monthlyBudgetUsd === undefined
      ? ''
      : String(policy.monthlyBudgetUsd));
  }, [policy?.monthlyBudgetUsd]);

  const statusLabel = summary?.status === 'ai_disabled'
    ? 'Disabled'
    : summary?.status === 'budget_reached'
      ? 'Budget reached'
      : summary?.status === 'approaching_budget'
        ? 'Approaching budget'
        : 'Healthy';
  const budgetUsedPercent = summary?.budget.monthlyBudgetUsd
    ? Math.min(100, Math.round((summary.totals.estimatedCostUsd / summary.budget.monthlyBudgetUsd) * 100))
    : 0;
  const joinedEmployees = employees.filter((employee) => employee.employeeUid);

  function handleSaveBudgetPress() {
    const trimmedDraft = budgetDraft.trim();
    const budget = trimmedDraft ? Number(trimmedDraft) : null;

    if (trimmedDraft && (!Number.isFinite(budget) || (budget ?? 0) < 0)) {
      Alert.alert('Invalid budget', 'Enter a valid monthly budget in dollars, or leave it blank for no budget.');
      return;
    }

    onSaveBudget(budget, policy?.hardLimitEnabled === true);
  }

  if (isLoading && !dashboard) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  if (!dashboard || !policy || !summary) {
    return (
      <View style={[styles.aiUsageUnavailableCard, { backgroundColor: appTheme.colors.groupedCard }]}>
        <View style={[styles.aiUsageUnavailableIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
          <Feather color={appTheme.colors.primary} name="cpu" size={22} />
        </View>
        <Text style={[styles.aiUsageUnavailableTitle, { color: appTheme.colors.ink }]}>AI usage is unavailable</Text>
        <Text style={[styles.aiUsageUnavailableText, { color: appTheme.colors.muted }]}>
          Refresh the dashboard after the backend finishes preparing the tenant usage data.
        </Text>
        <Pressable
          disabled={isLoading}
          onPress={onRefresh}
          style={({ pressed }) => [
            styles.aiUsageRefreshButton,
            { backgroundColor: appTheme.colors.primary },
            (pressed || isLoading) && styles.pressed
          ]}
        >
          {isLoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
          <Text style={styles.primaryButtonText}>{isLoading ? 'Refreshing...' : 'Refresh dashboard'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.aiUsageScreen}>
      <View style={[styles.aiUsageHero, { backgroundColor: appTheme.colors.groupedCard }]}>
        <View style={styles.aiUsageHeroHeader}>
          <View>
            <Text style={[styles.aiUsageEyebrow, { color: appTheme.colors.muted }]}>{summary.period.month}</Text>
            <Text style={[styles.aiUsageSpend, { color: appTheme.colors.ink }]}>{formatAiCurrency(summary.totals.estimatedCostUsd)}</Text>
          </View>
          <View style={[styles.aiUsageStatusPill, { borderColor: appTheme.colors.border }]}>
            <Text style={[styles.aiUsageStatusText, { color: appTheme.colors.primary }]}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={[styles.aiUsageMeta, { color: appTheme.colors.muted }]}>
          {summary.totals.successfulRequests} successful / {summary.totals.requests} total requests
        </Text>
        <View style={[styles.aiUsageProgressTrack, { backgroundColor: appTheme.colors.divider }]}>
          <View
            style={[
              styles.aiUsageProgressFill,
              {
                backgroundColor: summary.status === 'budget_reached' ? '#DC2626' : appTheme.colors.primary,
                width: `${policy.monthlyBudgetUsd === null ? 0 : budgetUsedPercent}%`
              }
            ]}
          />
        </View>
        <Text style={[styles.aiUsageMeta, { color: appTheme.colors.muted }]}>
          {policy.monthlyBudgetUsd === null
            ? 'No monthly hard budget set'
            : `${budgetUsedPercent}% of ${formatAiCurrency(policy.monthlyBudgetUsd)} monthly budget`}
        </Text>
      </View>

      <View style={[styles.aiUsageSection, { backgroundColor: appTheme.colors.groupedCard }]}>
        <AiUsageToggleRow
          disabled={isSaving}
          enabled={policy.companyAiEnabled}
          label="Company AI"
          onToggle={onToggleCompany}
          subtitle="Applies only to this tenant"
        />
        <View style={[styles.aiBudgetRow, { borderTopColor: appTheme.colors.divider }]}>
          <View style={styles.chatText}>
            <Text style={[styles.aiUsageRowTitle, { color: appTheme.colors.ink }]}>Monthly budget</Text>
            <Text style={[styles.aiUsageRowSubtitle, { color: appTheme.colors.muted }]}>Estimated OpenAI credit cost in dollars</Text>
          </View>
          <TextInput
            editable={!isSaving}
            keyboardType="decimal-pad"
            onChangeText={setBudgetDraft}
            placeholder="No limit"
            placeholderTextColor={appTheme.colors.muted}
            style={[styles.aiBudgetInput, { borderColor: appTheme.colors.border, color: appTheme.colors.ink }]}
            value={budgetDraft}
          />
        </View>
        <AiUsageToggleRow
          disabled={isSaving}
          enabled={policy.hardLimitEnabled}
          label="Hard stop at budget"
          onToggle={(enabled) => onSaveBudget(policy.monthlyBudgetUsd, enabled)}
          subtitle="Blocks AI when monthly spend reaches budget"
        />
        {/* Tinted text in the card, not a filled slab. House style: an action
            is a row you may take, not a wall across the screen. */}
        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={handleSaveBudgetPress}
          style={({ pressed }) => [
            aiActionStyles.row,
            { borderTopColor: appTheme.colors.separator },
            (pressed || isSaving) && styles.pressed
          ]}
        >
          <Text style={[aiActionStyles.text, { color: appTheme.colors.link }]}>
            {isSaving ? 'Saving' : 'Save budget'}
          </Text>
        </Pressable>
      </View>

      <AiUsageMetricGrid summary={summary} />

      <AiUsageSectionTitle title="Feature controls" />
      <View style={[styles.aiUsageSection, { backgroundColor: appTheme.colors.groupedCard }]}>
        {features.map((feature) => (
          <AiUsageToggleRow
            disabled={isSaving}
            enabled={policy.featurePolicies[feature.featureId]?.enabled !== false}
            key={feature.featureId}
            label={feature.label}
            onToggle={(enabled) => onToggleFeature(feature, enabled)}
            subtitle={formatBreakdownSubtitle(dashboard.breakdowns.features.find((row) => row.id === feature.featureId))}
          />
        ))}
      </View>

      {departments.length ? (
        <>
          <AiUsageSectionTitle title="Department controls" />
          <View style={[styles.aiUsageSection, { backgroundColor: appTheme.colors.groupedCard }]}>
            {departments.map((department) => (
              <AiUsageToggleRow
                disabled={isSaving}
                enabled={policy.departmentPolicies[department.departmentId]?.enabled !== false}
                key={department.departmentId}
                label={department.name}
                onToggle={(enabled) => onToggleDepartment(department, enabled)}
                subtitle={formatBreakdownSubtitle(dashboard.breakdowns.departments.find((row) => row.id === department.departmentId))}
              />
            ))}
          </View>
        </>
      ) : null}

      {joinedEmployees.length ? (
        <>
          <AiUsageSectionTitle title="Employee controls" />
          <View style={[styles.aiUsageSection, { backgroundColor: appTheme.colors.groupedCard }]}>
            {joinedEmployees.slice(0, 40).map((employee) => (
              <AiUsageToggleRow
                disabled={isSaving}
                enabled={employee.employeeUid ? policy.employeePolicies[employee.employeeUid]?.enabled !== false : true}
                key={employee.approvedPhoneId}
                label={employee.displayName || employee.phoneMasked}
                onToggle={(enabled) => onToggleEmployee(employee, enabled)}
                subtitle={formatBreakdownSubtitle(dashboard.breakdowns.employees.find((row) => row.id === employee.employeeUid))}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function AiUsageMetricGrid({ summary }: { summary: TenantAiUsageSummary }) {
  return (
    <View style={styles.aiMetricGrid}>
      <AiUsageMetric label="Input tokens" value={formatAiCompactNumber(summary.totals.inputTokens)} />
      <AiUsageMetric label="Output tokens" value={formatAiCompactNumber(summary.totals.outputTokens)} />
      <AiUsageMetric label="Audio seconds" value={formatAiCompactNumber(summary.generatedAudioSeconds)} />
      <AiUsageMetric label="Failures" value={String(summary.totals.failedRequests)} />
    </View>
  );
}

function AiUsageMetric({ label, value }: { label: string; value: string }) {
  const appTheme = useAppTheme();

  return (
    <View style={[styles.aiMetricCard, { backgroundColor: appTheme.colors.groupedCard }]}>
      <Text style={[styles.aiMetricValue, { color: appTheme.colors.primary }]}>{value}</Text>
      <Text style={[styles.aiMetricLabel, { color: appTheme.colors.muted }]}>{label}</Text>
    </View>
  );
}

function AiUsageSectionTitle({ title }: { title: string }) {
  const appTheme = useAppTheme();

  return <Text style={[styles.aiUsageSectionTitle, { color: appTheme.colors.ink }]}>{title}</Text>;
}

function AiUsageToggleRow({
  disabled,
  enabled,
  label,
  onToggle,
  subtitle
}: {
  disabled?: boolean;
  enabled: boolean;
  label: string;
  onToggle: (enabled: boolean) => void;
  subtitle: string;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={[styles.aiUsageToggleRow, { borderBottomColor: appTheme.colors.divider }]}>
      <View style={styles.chatText}>
        <Text numberOfLines={2} style={[styles.aiUsageRowTitle, { color: appTheme.colors.ink }]}>{label}</Text>
        <Text numberOfLines={2} style={[styles.aiUsageRowSubtitle, { color: appTheme.colors.muted }]}>{subtitle}</Text>
      </View>
      <AppSwitch
        disabled={disabled}
        onValueChange={onToggle}
        value={enabled}
      />
    </View>
  );
}

function formatBreakdownSubtitle(row?: { estimatedCostUsd: number; requestCount: number } | null): string {
  if (!row) {
    return 'No usage this month';
  }

  return `${formatAiCurrency(row.estimatedCostUsd)} / ${row.requestCount} requests this month`;
}

function formatAiCurrency(value: number | null | undefined): string {
  return `$${Number(value || 0).toFixed(4)}`;
}

function formatAiCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return String(Math.round(value));
}

const aiActionStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderTopWidth: 1,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 46,
    paddingVertical: 12
  },
  text: {
    fontSize: 16
  }
});
