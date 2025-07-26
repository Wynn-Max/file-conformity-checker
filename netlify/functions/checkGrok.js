const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  try {
    console.log('Function invoked with event:', {
      path: event.path,
      method: event.httpMethod,
      bodyLength: event.body?.length,
      headers: event.headers
    });

    if (event.httpMethod !== 'POST') {
      console.error('Invalid HTTP method:', event.httpMethod);
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    let body;
    try {
      console.log('Parsing JSON body...');
      body = JSON.parse(event.body || '{}');
      console.log('JSON parsed successfully:', {
        rubricTextLength: body.rubricText?.length,
        instructionsLength: body.instructions?.length,
        fileContentsLength: body.fileContents?.length
      });
    } catch (err) {
      console.error('JSON parse error:', err.message, err.stack);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Invalid JSON body: ${err.message}` })
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

    const deepSeekApiKey = process.env.DEEPSEEK_API_KEY;
    if (!deepSeekApiKey) {
      console.error('Missing DEEPSEEK_API_KEY environment variable');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error: Missing API key' })
      };
    }

    const fileResults = await Promise.all(fileContents.map(async file => {
      if (file.error) {
        console.log('File error detected:', file.fileName, file.error);
        return {
          fileName: file.fileName,
          results: [{
            requirement: 'File Processing',
            isConformant: false,
            suggestion: 'Ensure file is valid.',
            feedback: file.error,
            revisionInstruction: 'Upload a valid .docx, .xlsx, or .pdf file.',
            source: 'File validation'
          }],
          grade: 0,
          letterGrade: 'F'
        };
      }

      // Construct prompt for DeepSeek
      const prompt = `
        You are an academic assistant evaluating an essay against a rubric. The essay is about the Hollywood film "Avatar" (2009). The rubric requires:
        - Systematic knowledge of recent Hollywood industrial history.
        - Connections between Hollywood’s industrial configuration and the film.
        - Critical awareness of recent Hollywood trends and cultural significance.
        - A research project on the film’s cultural/commercial profile.
        - Use of primary materials (e.g., reviews, trailers, posters, interviews).
        - Incorporation of appropriate academic texts.
        - Harvard or Chicago referencing style.
        - Approximately 4,500 words (excluding notes and bibliography).
        - Analysis of a Hollywood or US independent film made after 1967.

        Essay content:
        ${file.content}

        Rubric details:
        ${rubricText || instructions}

        For each requirement, provide:
        - Requirement description
        - isConformant (true/false)
        - Feedback (why it meets or fails the requirement)
        - Suggestion (how to improve if not conformant)
        - Revision instruction (specific steps to fix if not conformant)
        - Source (e.g., "Module learning outcome" or "Assessment details")

        Return the evaluation in JSON format with an array of results and an overall grade (0-100) and letter grade (A-F).
      `;

      try {
        console.log('Calling DeepSeek API for file:', file.fileName);
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${deepSeekApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: 'You are a helpful academic assistant.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 4000,
            temperature: 0.7,
            response_format: { type: 'json_object' }
          })
        });

        const result = await response.json();
        if (!response.ok) {
          console.error('DeepSeek API error:', result);
          return {
            fileName: file.fileName,
            results: [{
              requirement: 'API Processing',
              isConformant: false,
              suggestion: 'Check API configuration.',
              feedback: `DeepSeek API error: ${result.error?.message || 'Unknown error'}`,
              revisionInstruction: 'Verify API key and endpoint.',
              source: 'DeepSeek API'
            }],
            grade: 0,
            letterGrade: 'F'
          };
        }

        console.log('DeepSeek API response received:', file.fileName);
        const evaluation = JSON.parse(result.choices[0].message.content);
        const results = evaluation.results || [];
        const grade = evaluation.grade || 0;
        const letterGrade = evaluation.letterGrade || 'F';

        return {
          fileName: file.fileName,
          results: results.map(r => ({
            requirement: r.requirement,
            isConformant: r.isConformant,
            suggestion: r.suggestion || '',
            feedback: r.feedback,
            revisionInstruction: r.revisionInstruction || '',
            source: r.source
          })),
          grade,
          letterGrade
        };
      } catch (err) {
        console.error(`Error processing file ${file.fileName}:`, err.message, err.stack);
        return {
          fileName: file.fileName,
          results: [{
            requirement: 'API Processing',
            isConformant: false,
            suggestion: 'Address API error.',
            feedback: `Error: ${err.message}`,
            revisionInstruction: 'Check API key, endpoint, or input size.',
            source: 'DeepSeek API'
          }],
          grade: 0,
          letterGrade: 'F'
        };
      }
    }));

    console.log('Returning fileResults:', fileResults);
    return {
      statusCode: 200,
      body: JSON.stringify({ fileResults })
    };
  } catch (error) {
    console.error('Function error:', {
      message: error.message,
      stack: error.stack,
      event: {
        path: event.path,
        bodyLength: event.body?.length
      }
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Server error: ${error.message}` })
    };
  }
};