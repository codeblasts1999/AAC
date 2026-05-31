from flask import Flask, request, jsonify, render_template
from groq import Groq
import os
import re

app = Flask(__name__)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

CONFIDENCE_RE = re.compile(r'^Confidence:\s*(\d+)%$', re.IGNORECASE)

@app.route('/')
def index():
    return render_template('template.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    user_input = data.get("message")

    if not user_input:
        return jsonify({"error": "No message provided"}), 400

    try:
        # --- Primary AI ---
        primary = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a supportive, calm, and predictable assistant for autistic teenagers. "
                        "Help them identify pros/cons, social impacts, and clear next steps for decisions. "
                        "Keep your vocabulary direct, your sentences short, and use structured bullet points where helpful. "
                        "When rating your confidence, use common sense: well-known everyday facts (colours of foods, basic science, "
                        "common sense facts about the world) deserve high confidence (85-95%). Reserve lower confidence for genuinely "
                        "uncertain, contested, culturally variable, or highly personal topics. Do not hedge on things that are plainly and objectively true. "
                        "At the very end of every response, on its own line, write exactly: "
                        "Confidence: X% (where X is your integer confidence level from 0 to 100 for the advice you just gave). "
                        "Nothing should follow that line."
                    )
                },
                {"role": "user", "content": user_input}
            ]
        )
        reply = primary.choices[0].message.content

        # --- Governance AI ---
        # Parse the confidence the primary AI claimed
        lines = reply.rstrip().split('\n')
        last_line = lines[-1].strip()
        match = CONFIDENCE_RE.match(last_line)

        if match:
            primary_confidence = int(match.group(1))
            reply_body = '\n'.join(lines[:-1]).rstrip()

            gov = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a strict governance reviewer for an AI assistant used by autistic teenagers. "
                            "Your only job is to decide if the primary AI's confidence score is justified. "
                            "Overconfidence is harmful — when in doubt, lower the score. "
                            "You may ONLY lower the confidence, never raise it. "
                            "Be especially strict about medical, legal, financial, safety, or social advice. "
                            "Reply with a SINGLE INTEGER between 0 and 100. No explanation, no punctuation, nothing else."
                        )
                    },
                    {
                        "role": "user",
                        "content": (
                            f"User question: {user_input}\n\n"
                            f"AI response:\n{reply_body}\n\n"
                            f"Primary AI claimed confidence: {primary_confidence}%\n\n"
                            "What should the confidence be? You can only lower it. Reply with one integer."
                        )
                    }
                ]
            )

            gov_text = gov.choices[0].message.content.strip()
            gov_match = re.match(r'^(\d+)', gov_text)
            if gov_match:
                gov_confidence = int(gov_match.group(1))
                # Governance can only lower, never raise
                final_confidence = min(primary_confidence, gov_confidence)
                reply = f"{reply_body}\nConfidence: {final_confidence}%"

        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
