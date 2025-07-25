import fetch from 'node-fetch';
const fetch = require('node-fetch');

exports.handler = async (event) => {
  const { report, instructions } = JSON.parse(event.body);

  const prompt = `Check the following academic report for conformity to these instructions:\n\nInstructions:\n${instructions}\n\nReport:\n${report}\n\nGive clear and specific feedback.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful academic evaluator.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4
      })
    });

    const data = await res.json();
    const feedback = data.choices?.[0]?.message?.content || 'No feedback received.';

    return {
      statusCode: 200,
      body: JSON.stringify({ feedback })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ feedback: 'Error: ' + err.message })
    };
  }
};
