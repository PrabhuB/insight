import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase environment variables not configured');
      return new Response(
        JSON.stringify({ error: 'Backend not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Unauthorized extract-payslip call', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { imageBase64 } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(
        JSON.stringify({ error: 'No image provided or invalid format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Basic validation for base64 image payloads to prevent abuse / DoS
    const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

    let base64Data = imageBase64;
    let mimeType: string | null = null;

    // Support standard data URLs: data:image/png;base64,....
    const dataUrlMatch = /^data:(.*);base64,(.*)$/.exec(imageBase64);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      base64Data = dataUrlMatch[2];
    }

    // Enforce allowed image types when a MIME type is provided
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (mimeType && !allowedMimeTypes.includes(mimeType)) {
      return new Response(
        JSON.stringify({ error: 'Unsupported image type. Please upload PNG, JPEG, or WebP images.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rough size estimation from base64 length
    const approximateBytes = Math.floor((base64Data.length * 3) / 4);
    if (approximateBytes > MAX_IMAGE_BYTES) {
      return new Response(
        JSON.stringify({ error: 'Image is too large. Maximum size is 10MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Simple character check to avoid obviously malformed base64
    const base64Regex = /^[A-Za-z0-9+/=\r\n]+$/;
    if (!base64Regex.test(base64Data)) {
      return new Response(
        JSON.stringify({ error: 'Invalid image encoding.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting payslip data using AI for user', user.id);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a payslip data extraction expert. Extract salary information from payslip images.
Extract the following information accurately:
- Organization/Company name
- Month and Year (in format: month number 1-12, and year)
- All earnings items with their amounts (Basic Salary, HRA, Allowances, etc.)
- All deduction items with their amounts (PF, Tax, PT, etc.)

Return ONLY valid JSON without any markdown formatting or code blocks.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all salary details from this payslip image. Include organization name, month, year, all earnings with categories and amounts, and all deductions with categories and amounts.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_payslip_data',
              description: 'Extract structured salary data from payslip',
              parameters: {
                type: 'object',
                properties: {
                  organization: {
                    type: 'string',
                    description: 'Company or organization name'
                  },
                  month: {
                    type: 'number',
                    description: 'Month number (1-12)',
                    minimum: 1,
                    maximum: 12
                  },
                  year: {
                    type: 'number',
                    description: 'Year (e.g., 2024)',
                    minimum: 2000,
                    maximum: 2100
                  },
                  earnings: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        category: { type: 'string' },
                        amount: { type: 'number' },
                        description: { type: 'string' }
                      },
                      required: ['category', 'amount']
                    }
                  },
                  deductions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        category: { type: 'string' },
                        amount: { type: 'number' },
                        description: { type: 'string' }
                      },
                      required: ['category', 'amount']
                    }
                  }
                },
                required: ['earnings', 'deductions']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_payslip_data' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI extraction failed' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('AI response received');

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error('No tool call in response');
      return new Response(
        JSON.stringify({ error: 'Failed to extract structured data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    
    console.log('Extraction successful');
    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-payslip:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
