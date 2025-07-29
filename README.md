# SANSON - Cybersecurity Assistant Extension for VSCode
Version: 1.0.0 Jul 29, 2025.
Author: Fender Urbano.

## Features
1. Analyze bad practices that represent a security breach. Its use is limited to 50 requests per day and uses an existing model (Kimi V2).
2. Identify which dependencies are outdated. Limited to analyzing dependencies in "package.json".
3. Calculate the number of days since the last update for each dependency. Limited to dependencies in "package.json".

## Requirements
**IMPORTANT**, to use the "SansonAI: Detect security gaps in the code" command, the "API_KEY" environment variable is required, there are two ways:
1. Create a .env file and write "API_KEY=you_real_api_key_here" to it, you can get an API_KEY by https://openrouter.ai/moonshotai/kimi-k2:free/api
2. Send an email to "fenderurbano.business@gmail.com" to request the API_KEY, you will receive an email, sign in or login to "dotenv"
   - Copy, paste and press "enter" into the terminal: npx dotenv-vault@latest pull
   - Press "y"
   - The ".env" file will be inserted into the project, you can now run the command to analyze with AI

## How to install and use?

### Steps: ###
1. Open VScode
2. Clone this repository: https://github.com/FenderU/sansonai-prototype.git
3. Open terminal in VSCode
4. Copy, paste and press "enter" into the terminal: npm install node-fetch
5. Open the file: src/extension.ts
6. Press F5
7. Select "VS Code Extension Development"
8. A new VSCode instance should appear
9. In the new instance, with "Ctrl + Shift + P" you can access the commands that Sanson allows. For example: "SansonAI: Detect security gaps in the code"
   
## Release Notes

### 1.0.0

Initial release of sanson extension for vscode

### Please share your feedback, will allow a good result 
Email: fenderurbano.business@gmail.com
