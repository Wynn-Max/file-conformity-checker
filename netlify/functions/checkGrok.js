// netlify/functions/checkGrok.js
const fetch = require('node-fetch');

// Check APA style formatting
const checkAPAStyle = (text) => {
  const apaRegex = /[A-Za-z\s.,]+ \(\d{4}\)\.\s[A-Za-z\s.,]+\.\s[A-Za-z\s.,]+/;
  return apaRegex.test(text);
};

// Parse requirements
const parseRequirements = (rubricText, instructionsText) => {
  console.log('Parsing requirements with rubricText length:', rubricText?.length, 'instructionsText length:', instructionsText?.length);
  const combinedText = `${rubricText || ''} ${instructionsText || ''}`.toLowerCase();
  const requirements = [];

  const requirementPatterns = [
    { id: 'pivot_table', pattern: /pivot\s*table/i, desc: 'Include pivot table with specific fields (e.g., Business Student, Athlete, Cheated)', source: 'Excel documentation: https://support.microsoft.com/en-us/office/create-a-pivottable' },
    { id: 'bar_chart', pattern: /bar\s*chart|figure|chart/i, desc: 'Include bar chart visualizing data, embedded in the document', source: 'Excel charting guide: https://support.microsoft.com/en-us/office/create-a-chart' },
    { id: 'hypothesis_tests', pattern: /hypothesis\s*test|hypothes[ie]s|h0|p-value/i, desc: 'Perform hypothesis tests with H0, Ha, test statistics, and p-values', source: 'Statistics textbook: "Introduction to Statistics" by Weiss' },
    { id: 'ethical_summary', pattern: /ethical\s*summary|ethics|bretag/i, desc: 'Include ethical summary with at least three references', source: 'Bretag, T. (2016). Handbook of Academic Integrity.' },
    { id: 'apa_style', pattern: /apa\s*style|apa\s*format/i, desc: 'Follow APA Style formatting for references', source: 'APA Style Guide: https://apastyle.apa.org' },
    { id: 'biblical_principles', pattern: /biblical\s*principles|luke|proverbs/i, desc: 'Include biblical principles in the ethical summary (e.g., Luke 16:10-12)', source: 'Holy Bible, NIV: Luke 16:10-12' }
  ];

  requirementPatterns.forEach(({ id, pattern, desc, source }) => {
    if (pattern.test(combinedText)) {
      requirements.push({ id, desc, source });
    }
  });

  if (requirements.length === 0 && combinedText.trim()) {
    requirements.push({ id: 'general_content', desc: 'Ensure content aligns with guidelines', source: 'Consult assignment guidelines.' });
  }

  console.log('Parsed requirements:', requirements.length);
  return requirements;
};

// Analyze file content
const analyzeFile = (content, requirement) => {
  console.log('Analyzing file for requirement:', requirement.id);
  const contentLower = content.toLowerCase();
  let isConformant = false;
  let suggestion = '';
  let feedback = '';
  let revisionInstruction = '';

  switch (requirement.id) {
    case 'pivot_table':
      isConformant = /pivot\s*table/i.test(contentLower);
      suggestion = isConformant ? '' : 'Include a pivot table with specified fields.';
      revisionInstruction = isConformant ? '' : 'Use Excel: Insert > PivotTable, include fields like Business Student, Athlete, Cheated.';
      feedback = isConformant ? 'Pivot table detected.' : 'No pivot table found.';
      break;
    case 'bar_chart':
      isConformant = /bar\s*chart|figure|chart/i.test(contentLower);
      suggestion = isConformant ? '' : 'Include a bar chart visualizing data.';
      revisionInstruction = isConformant ? '' : 'Create a bar chart in Excel: Insert > Bar Chart, embed in document.';
      feedback = isConformant ? 'Bar chart detected.' : 'No bar chart found.';
      break;
    case 'hypothesis_tests':
      isConformant = /hypothesis|h0|p-value/i.test(contentLower);
      suggestion = isConformant ? '' : 'Document hypothesis tests with H0, Ha, p-values.';
      revisionInstruction = isConformant ? '' : 'Use Excel/SPSS: Define H0, Ha, calculate p-values, document results.';
      feedback = isConformant ? 'Hypothesis tests documented.' : 'No hypothesis tests found.';
      break;
    case 'ethical_summary':
      isConformant = /ethical|ethics|bretag/i.test(contentLower);
      suggestion = isConformant ? '' : 'Include an ethical summary with three references.';
      revisionInstruction = isConformant ? '' : 'Write an ethical summary citing sources (e.g., Bretag, 2016).';
      feedback = isConformant ? 'Ethical summary detected.' : 'No ethical summary found.';
      break;
    case 'apa_style':
      isConformant = checkAPAStyle(content);
      suggestion = isConformant ? '' : 'Ensure APA Style references.';
      revisionInstruction = isConformant ? '' : 'Format references per APA 7th: Author. (Year). Title. Source.';
      feedback = isConformant ? 'APA-style references detected.' : 'References not in APA Style.';
      break;
    case 'biblical_principles':
      isConformant = /biblical|luke|proverbs/i.test(contentLower);
      suggestion = isConformant ? '' : 'Include biblical principles (e.g., Luke 16:10-12).';
      revisionInstruction = isConformant ? '' : 'Add biblical principles (e.g., Luke 16:10-12) in ethical summary.';
      feedback = isConformant ? 'Biblical principles included.' : 'No biblical principles found.';
      break;
    case 'general_content':
      isConformant = content.trim().length > 0;
      suggestion = isConformant ? '' : 'Ensure file contains relevant content.';
      revisionInstruction = isConformant ? '' : 'Review rubric and include required content.';
      feedback = isConformant ? 'Content present.' : 'No relevant content found.';
      break;
  }

  return { isConformant, suggestion, feedback, revisionInstruction };
};

// Netlify Function handler
exports.handler = async (event, context) => {
  try {
    console.log('Function invoked with event:', JSON.stringify(event, null, 2));
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (err) {
      console.error('JSON parse error:', err.message);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON body' })
      };
    }

    const { rubricText, instructions, fileContents } = body;

    if (!rubricText && !instructions) {
      console.error('Missing rubric or instructions');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Rubric or instructions required' })
      };
    }

    if (!fileContents || !Array.isArray(fileContents) || fileContents.length === 0) {
      console.error('Invalid fileContents:', fileContents);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'At least one report file required' })
      };
    }

    const requirements = parseRequirements(rubricText, instructions);

    if (requirements.length === 0) {
      console.error('No requirements identified');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No requirements identified. Ensure rubric contains keywords like "pivot table".' })
      };
    }

    const fileResults = fileContents.map(file => {
      if (file.error) {
        console.log('File error detected:', file.fileName, file.error);
        return {
          fileName: file.fileName,
          results: [{
            requirement: 'File Processing',
            isConformant: false,
            suggestion: 'Ensure file is valid.',
            feedback: file.error,
            revisionInstruction: 'Upload a valid .docx, .xlsx, or .pdf file.'
          }]
        };
      }

      const results = requirements.map(req => ({
        ...analyzeFile(file.content, req),
        requirement: req.desc,
        source: req.source
      }));

      return { fileName: file.fileName, results };
    });

    console.log('Returning fileResults:', fileResults.length);
    return {
      statusCode: 200,
      body: JSON.stringify({ fileResults })
    };
  } catch (error) {
    console.error('Function error:', error.message, error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Server error: ${error.message}` })
    };
  }
};