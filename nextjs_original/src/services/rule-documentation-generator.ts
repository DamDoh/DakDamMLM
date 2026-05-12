import type { BusinessRule } from '@/lib/types';

export class RuleDocumentationGenerator {
  /**
   * Generate comprehensive Markdown documentation for business rules
   */
  static generateMarkdown(rules: BusinessRule[]): string {
    let doc = '# Business Rules Documentation\n\n';
    doc += `Generated on: ${new Date().toISOString()}\n\n`;
    doc += `Total Rules: ${rules.length}\n\n`;
    doc += '## Table of Contents\n\n';

    // Group by category
    const categories = rules.reduce((acc, rule) => {
      if (!acc[rule.category]) acc[rule.category] = [];
      acc[rule.category].push(rule);
      return acc;
    }, {} as Record<string, BusinessRule[]>);

    // Add table of contents
    Object.keys(categories).forEach(category => {
      doc += `- [${category.charAt(0).toUpperCase() + category.slice(1)} Rules](#${category.toLowerCase()}-rules)\n`;
    });
    doc += '\n---\n\n';

    // Generate documentation by category
    Object.entries(categories).forEach(([category, categoryRules]) => {
      doc += `## ${category.charAt(0).toUpperCase() + category.slice(1)} Rules\n\n`;
      doc += `**Total Rules in Category:** ${categoryRules.length}\n\n`;

      categoryRules.forEach(rule => {
        doc += `### ${rule.name}\n\n`;
        doc += `**ID:** \`${rule.id}\`\n\n`;
        doc += `**Description:** ${rule.description}\n\n`;
        doc += `**Type:** ${rule.type}\n\n`;
        doc += `**Priority:** ${rule.priority}\n\n`;
        doc += `**Status:** ${rule.isActive ? '✅ Active' : '❌ Inactive'}\n\n`;
        doc += `**Applicable To:** ${rule.applicableTo.join(', ')}\n\n`;
        doc += `**Frequency:** ${rule.frequency}\n\n`;
        doc += `**Payout Timing:** ${rule.payoutTiming}\n\n`;

        if (rule.conditions.length > 0) {
          doc += `**Conditions:**\n\n`;
          doc += '| Condition Type | Operator | Value | Logical Operator |\n';
          doc += '|----------------|----------|-------|------------------|\n';
          rule.conditions.forEach(condition => {
            doc += `| ${condition.type} | ${condition.operator} | ${condition.value} | ${condition.logicalOperator || 'N/A'} |\n`;
          });
          doc += '\n';
        }

        doc += `**Calculation:**\n\n`;
        doc += '```\n';
        doc += this.formatCalculation(rule.calculation);
        doc += '\n```\n\n';

        if (rule.tags.length > 0) {
          doc += `**Tags:** ${rule.tags.map(tag => `\`${tag}\``).join(', ')}\n\n`;
        }

        doc += `**Version:** ${rule.version} | **Created:** ${rule.createdAt} | **Updated:** ${rule.updatedAt}\n\n`;
        doc += '---\n\n';
      });
    });

    // Add compliance section
    doc += this.generateComplianceSection(rules);

    return doc;
  }

  /**
   * Generate HTML documentation
   */
  static generateHTML(rules: BusinessRule[]): string {
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Business Rules Documentation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #e1e5e9;
            padding-bottom: 20px;
            margin-bottom: 40px;
        }
        .rule {
            border: 1px solid #e1e5e9;
            border-radius: 6px;
            margin: 20px 0;
            padding: 20px;
            background: #fafbfc;
        }
        .rule-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            margin: -20px -20px 20px -20px;
            border-radius: 6px 6px 0 0;
        }
        .rule-meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 15px 0;
        }
        .meta-item {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            border-left: 3px solid #667eea;
        }
        .conditions-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        .conditions-table th,
        .conditions-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        .conditions-table th {
            background: #f2f2f2;
        }
        .calculation {
            background: #e8f5e8;
            border: 1px solid #c3e6c3;
            border-radius: 4px;
            padding: 15px;
            margin: 15px 0;
            font-family: 'Courier New', monospace;
        }
        .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin: 10px 0;
        }
        .tag {
            background: #e1ecf4;
            color: #39739d;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
        }
        .status-active {
            color: #28a745;
            font-weight: bold;
        }
        .status-inactive {
            color: #dc3545;
            font-weight: bold;
        }
        .compliance {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 20px;
            margin: 30px 0;
        }
        .compliance h2 {
            color: #856404;
            margin-top: 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Business Rules Documentation</h1>
            <p>Generated on: ${new Date().toISOString()}</p>
            <p><strong>Total Rules:</strong> ${rules.length}</p>
        </div>
`;

    // Group by category
    const categories = rules.reduce((acc, rule) => {
      if (!acc[rule.category]) acc[rule.category] = [];
      acc[rule.category].push(rule);
      return acc;
    }, {} as Record<string, BusinessRule[]>);

    Object.entries(categories).forEach(([category, categoryRules]) => {
      html += `<h2>${category.charAt(0).toUpperCase() + category.slice(1)} Rules (${categoryRules.length})</h2>`;

      categoryRules.forEach(rule => {
        html += `
        <div class="rule">
            <div class="rule-header">
                <h3>${rule.name}</h3>
                <p><strong>ID:</strong> ${rule.id}</p>
            </div>

            <p><strong>Description:</strong> ${rule.description}</p>

            <div class="rule-meta">
                <div class="meta-item">
                    <strong>Type:</strong> ${rule.type}
                </div>
                <div class="meta-item">
                    <strong>Priority:</strong> ${rule.priority}
                </div>
                <div class="meta-item">
                    <strong>Status:</strong> <span class="${rule.isActive ? 'status-active' : 'status-inactive'}">${rule.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <div class="meta-item">
                    <strong>Frequency:</strong> ${rule.frequency}
                </div>
                <div class="meta-item">
                    <strong>Payout Timing:</strong> ${rule.payoutTiming}
                </div>
            </div>

            <p><strong>Applicable To:</strong> ${rule.applicableTo.join(', ')}</p>

            ${rule.conditions.length > 0 ? `
            <h4>Conditions</h4>
            <table class="conditions-table">
                <thead>
                    <tr>
                        <th>Condition Type</th>
                        <th>Operator</th>
                        <th>Value</th>
                        <th>Logical Operator</th>
                    </tr>
                </thead>
                <tbody>
                    ${rule.conditions.map(condition => `
                        <tr>
                            <td>${condition.type}</td>
                            <td>${condition.operator}</td>
                            <td>${condition.value}</td>
                            <td>${condition.logicalOperator || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : ''}

            <h4>Calculation</h4>
            <div class="calculation">
                ${this.formatCalculation(rule.calculation)}
            </div>

            ${rule.tags.length > 0 ? `
            <div class="tags">
                ${rule.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            ` : ''}

            <p><small><strong>Version:</strong> ${rule.version} | <strong>Created:</strong> ${rule.createdAt} | <strong>Updated:</strong> ${rule.updatedAt}</small></p>
        </div>
`;
      });
    });

    // Add compliance section
    html += this.generateComplianceHTML(rules);

    html += `
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Generate JSON documentation
   */
  static generateJSON(rules: BusinessRule[]): string {
    const documentation = {
      generatedAt: new Date().toISOString(),
      totalRules: rules.length,
      summary: {
        byCategory: rules.reduce((acc, rule) => {
          acc[rule.category] = (acc[rule.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byType: rules.reduce((acc, rule) => {
          acc[rule.type] = (acc[rule.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        activeRules: rules.filter(r => r.isActive).length,
        inactiveRules: rules.filter(r => !r.isActive).length
      },
      rules: rules.map(rule => ({
        ...rule,
        calculationFormatted: this.formatCalculation(rule.calculation),
        compliance: this.checkRuleCompliance(rule)
      }))
    };

    return JSON.stringify(documentation, null, 2);
  }

  /**
   * Generate compliance report
   */
  static generateComplianceReport(rules: BusinessRule[]): string {
    let report = '# Compliance Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    const compliance = this.analyzeCompliance(rules);

    report += '## Compliance Summary\n\n';
    report += `- **Overall Score:** ${compliance.overallScore}/100\n`;
    report += `- **Critical Issues:** ${compliance.criticalIssues}\n`;
    report += `- **Warnings:** ${compliance.warnings}\n`;
    report += `- **Suggestions:** ${compliance.suggestions}\n\n`;

    report += '## Detailed Analysis\n\n';

    // Commission caps check
    const hasCommissionCaps = rules.some(r => r.calculation.cap);
    report += `### Commission Caps\n`;
    report += `Status: ${hasCommissionCaps ? '✅ Present' : '❌ Missing'}\n\n`;
    if (!hasCommissionCaps) {
      report += `**Recommendation:** Add commission caps to prevent unlimited payouts.\n\n`;
    }

    // High-risk rules
    const highRiskRules = rules.filter(r => r.priority > 500 || r.calculation.cap === undefined);
    if (highRiskRules.length > 0) {
      report += `### High-Risk Rules\n\n`;
      highRiskRules.forEach(rule => {
        report += `- **${rule.name}** (Priority: ${rule.priority})\n`;
        if (rule.calculation.cap === undefined) {
          report += `  - Missing commission cap\n`;
        }
      });
      report += '\n';
    }

    // Rule conflicts
    const conflicts = this.detectRuleConflicts(rules);
    if (conflicts.length > 0) {
      report += `### Rule Conflicts\n\n`;
      conflicts.forEach(conflict => {
        report += `- **${conflict.rule1}** conflicts with **${conflict.rule2}**\n`;
        report += `  Reason: ${conflict.reason}\n\n`;
      });
    }

    // Performance issues
    const performanceIssues = rules.filter(r =>
      r.calculation.type === 'formula' ||
      r.conditions.length > 10
    );
    if (performanceIssues.length > 0) {
      report += `### Performance Considerations\n\n`;
      performanceIssues.forEach(rule => {
        report += `- **${rule.name}**: Complex ${rule.calculation.type === 'formula' ? 'formula' : 'conditions'} may impact performance\n`;
      });
      report += '\n';
    }

    return report;
  }

  /**
   * Format calculation for display
   */
  private static formatCalculation(calc: any): string {
    switch (calc.type) {
      case 'percentage':
        return `${calc.percentage}% of base value`;
      case 'fixed_amount':
        return `$${calc.baseValue} fixed amount`;
      case 'per_unit':
        return `$${calc.baseValue} per unit`;
      case 'tiered_percentage':
        return `Tiered percentage:\n${calc.tiers?.map((t: any) =>
          `  ${t.min} - ${t.max || '∞'}: ${t.value}%`
        ).join('\n')}`;
      case 'tiered_fixed':
        return `Tiered fixed:\n${calc.tiers?.map((t: any) =>
          `  ${t.min} - ${t.max || '∞'}: $${t.value}`
        ).join('\n')}`;
      case 'formula':
        return `Formula: ${calc.formula}`;
      case 'lookup_table':
        return `Lookup table with ${Object.keys(calc.lookupTable || {}).length} entries`;
      case 'conditional':
        return `Conditional calculation with ${calc.conditions?.length || 0} conditions`;
      default:
        return calc.type;
    }
  }

  /**
   * Generate compliance section for Markdown
   */
  private static generateComplianceSection(rules: BusinessRule[]): string {
    let section = '## Compliance & Risk Analysis\n\n';

    const compliance = this.analyzeCompliance(rules);

    section += `### Risk Assessment\n\n`;
    section += `- **Risk Level:** ${compliance.overallScore >= 80 ? 'Low' : compliance.overallScore >= 60 ? 'Medium' : 'High'}\n`;
    section += `- **Critical Issues:** ${compliance.criticalIssues}\n`;
    section += `- **Warnings:** ${compliance.warnings}\n\n`;

    if (compliance.criticalIssues > 0) {
      section += `### ⚠️ Critical Issues\n\n`;
      // Add specific critical issues here
    }

    return section;
  }

  /**
   * Generate compliance section for HTML
   */
  private static generateComplianceHTML(rules: BusinessRule[]): string {
    const compliance = this.analyzeCompliance(rules);

    return `
        <div class="compliance">
            <h2>Compliance & Risk Analysis</h2>
            <div class="rule-meta">
                <div class="meta-item">
                    <strong>Risk Level:</strong> ${compliance.overallScore >= 80 ? 'Low' : compliance.overallScore >= 60 ? 'Medium' : 'High'}
                </div>
                <div class="meta-item">
                    <strong>Critical Issues:</strong> ${compliance.criticalIssues}
                </div>
                <div class="meta-item">
                    <strong>Warnings:</strong> ${compliance.warnings}
                </div>
                <div class="meta-item">
                    <strong>Overall Score:</strong> ${compliance.overallScore}/100
                </div>
            </div>
        </div>
`;
  }

  /**
   * Analyze compliance of rules
   */
  private static analyzeCompliance(rules: BusinessRule[]): any {
    let criticalIssues = 0;
    let warnings = 0;
    let suggestions = 0;

    // Check for commission caps
    const commissionRules = rules.filter(r => r.type.includes('commission'));
    const rulesWithCaps = commissionRules.filter(r => r.calculation.cap);
    if (rulesWithCaps.length < commissionRules.length * 0.8) {
      criticalIssues++;
    }

    // Check for high-priority rules without proper validation
    const highPriorityRules = rules.filter(r => r.priority > 500);
    highPriorityRules.forEach(rule => {
      if (!rule.calculation.cap) {
        warnings++;
      }
    });

    // Check for complex rules that might be hard to maintain
    const complexRules = rules.filter(r =>
      r.calculation.type === 'formula' ||
      r.conditions.length > 5
    );
    complexRules.forEach(() => {
      suggestions++;
    });

    const overallScore = Math.max(0, 100 - (criticalIssues * 20) - (warnings * 5) - (suggestions * 2));

    return {
      overallScore,
      criticalIssues,
      warnings,
      suggestions
    };
  }

  /**
   * Check individual rule compliance
   */
  private static checkRuleCompliance(rule: BusinessRule): any {
    const issues = [];

    if (rule.type.includes('commission') && !rule.calculation.cap) {
      issues.push('Missing commission cap');
    }

    if (rule.priority > 500 && rule.conditions.length === 0) {
      issues.push('High priority rule with no conditions');
    }

    if (rule.calculation.type === 'formula' && !rule.calculation.formula) {
      issues.push('Formula calculation missing formula');
    }

    return {
      compliant: issues.length === 0,
      issues
    };
  }

  /**
   * Detect rule conflicts
   */
  private static detectRuleConflicts(rules: BusinessRule[]): any[] {
    const conflicts = [];

    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const rule1 = rules[i];
        const rule2 = rules[j];

        // Check for overlapping conditions and applicability
        const hasOverlappingConditions = rule1.conditions.some(c1 =>
          rule2.conditions.some(c2 => c1.type === c2.type)
        );

        const hasOverlappingApplicability = rule1.applicableTo.some(type =>
          rule2.applicableTo.includes(type)
        );

        if (hasOverlappingConditions && hasOverlappingApplicability) {
          conflicts.push({
            rule1: rule1.name,
            rule2: rule2.name,
            reason: 'Overlapping conditions and applicability'
          });
        }

        // Check for duplicate priorities
        if (rule1.priority === rule2.priority && rule1.category === rule2.category) {
          conflicts.push({
            rule1: rule1.name,
            rule2: rule2.name,
            reason: 'Duplicate priorities in same category'
          });
        }
      }
    }

    return conflicts;
  }
}