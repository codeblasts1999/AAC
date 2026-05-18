from flask import Flask, request, jsonify, render_template
from groq import Groq
import os

app = Flask(__name__)

# Pulls your API key from the environment variables
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    user_input = data.get("message")

    # FIXED: "error" must be a string literal key inside jsonify
    if not user_input:
        return jsonify({"error": "No message provided"}), 400
    
    try:
        chat_completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system", 
                    "content": "You are a supportive, calm, and predictable assistant for autistic teenagers. Help them identify pros/cons, social impacts, and clear next steps for decisions. Keep your vocabulary direct, your sentences short, and use structured bullet points where helpful."
                },
                {"role": "user", "content": user_input}
            ]
        )
        reply = chat_completion.choices[0].message.content
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)