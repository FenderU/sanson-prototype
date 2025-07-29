import * as path from 'path';
import { config } from '@dotenvx/dotenvx';

config({ path: path.resolve(__dirname, '../.env'), debug: true });
const API_KEY= process.env.API_KEY;

import * as vscode from 'vscode';
import('node-fetch');
import * as fs from 'fs';
const semver = require('semver');

interface ObsoleteDependencies {
  name: string;
  currentVersion: string;
  latestVersion: string;
}

interface answerIA {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
}

type answerNpm = {
	'dist-tags': {
		latest: string;
	};
	versions: Record<string, any>;
	time: Record<string, string>;
};

export function activate(context: vscode.ExtensionContext) {
	console.log('SansonAI active');
	context.subscriptions.push(
		vscode.commands.registerCommand("sansonai-ex.analyzeCode", analyzeCode),
		vscode.commands.registerCommand("sansonai-ex.checkDependencies", checkDependencies),
		vscode.commands.registerCommand("sansonai-ex.checkPeriodicity", checkPeriodicity)
	);


}

// Identify security gaps in code with AI
async function analyzeCode() {
	const editor = vscode.window.activeTextEditor;
	if (!editor){ return vscode.window.showWarningMessage('There is no open file.');}	
	
	if (!API_KEY) {
		throw new Error("API_KEY is not defined. Check your dotenv vault configuration.");
	}

	const code=editor.document.getText();
	
	// PROMPT
	const prompt=`
		Analyze the given code and identify bad programming practices that represent a security breach.
		Such as SQL injections, use of "eval", or unprepared statements).
		Return the result in the following JSON format only and exclusively respond with the JSON. Do not include any explanations or markdown:

		{
  		"result": "A general summary of the code analysis.",
  		"alerts": 
			[
				{
				"line": number,
				"message": "Description of the issue found at that line."
				},
  			]
		}

		The code to analyze is:
		${code}
	`;

	const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
	method: "POST",
	headers: {
		"Authorization": `Bearer ${API_KEY}`,
		"Content-Type": "application/json"
	},
	body: JSON.stringify({
		"model": "moonshotai/kimi-k2:free",
		"messages": [ {"role": "user", "content": prompt}]
	})
	});

	if (!response.ok) {
    	const errorText = await response.text();
		vscode.window.showWarningMessage("ERROR API KIMI");
    	throw new Error(`Kimi API error ${response.status}: ${errorText}`);
  	}

	const raw = await response.json() as answerIA;
	const content=raw.choices?.[0]?.message?.content;
	console.log(content);
	
	if (content) {
		try {
			const results = JSON.parse(content);
			const outputSummary = results.result ?? 'No results';
			vscode.window.showInformationMessage('Kimi say: ' + outputSummary);

			// DIAGNOSE
			const diagnostics: vscode.Diagnostic[] = [];
		    if (results.alerts && Array.isArray(results.alerts)) {
				const editor = vscode.window.activeTextEditor;
				if (editor) {
					const document = editor.document;

					for (const alert of results.alerts) {
						const line = alert.line - 1; 
						const message = alert.message ?? "Kimi's Warning";
						// We check if the line exists in the document
						if (line >= 0 && line < document.lineCount) {
							const lineText = document.lineAt(line);
							const range = new vscode.Range(line, 0, line, lineText.text.length);

							const diagnostic = new vscode.Diagnostic(
							range,
							message,
							vscode.DiagnosticSeverity.Warning
							);
							diagnostics.push(diagnostic);
						}
					}
					// We will assign the diagnoses to a collection
					const diagnosticCollection = vscode.languages.createDiagnosticCollection("kimi");
					diagnosticCollection.set(document.uri, diagnostics);	
				}	
    		}
		} catch (e) {
			vscode.window.showErrorMessage("Error parsing Kimi's response.");
			console.error('Error parsing JSON.parse:', e);
		}
	} else {
    vscode.window.showWarningMessage("Kimi doesn't respond");
	}
}

async function checkDependencies(){
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
  		vscode.window.showErrorMessage("No workspace is opened.");
  		return;
	}

	const packageJsonPath = path.join(workspaceFolders[0].uri.fsPath, 'package.json');	
	if (!fs.existsSync(packageJsonPath)) {
	vscode.window.showErrorMessage("No package.json found in the project.");
	return;
	}

	const obsolete: ObsoleteDependencies[] = [];
	const content = fs.readFileSync(packageJsonPath, 'utf8');
	const packageJson = JSON.parse(content);

	const dependencies = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {}),
    };

    for (const [name, currentVersion] of Object.entries(dependencies)) {
    	try {
      	const res = await fetch(`https://registry.npmjs.org/${name}`);
      	if (!res.ok) {
        console.warn(`No information could be obtained from ${name}`);
        continue;
      	}

      	const data = await res.json() as answerNpm;
     	const latestVersion = data['dist-tags']?.latest;
		const installed=semver.minVersion(currentVersion);
		console.log(installed);

	  	if(typeof currentVersion==='string'){
			if(installed && latestVersion && semver.lt(installed,latestVersion)) {
				obsolete.push({
				name,
				currentVersion,
				latestVersion,
				});
			}
		}
		
		} catch (error) {
		console.error(`Error verifying ${name}:`, error);
		}
	}

	// DIAGNOSE
		const diagnostics: vscode.Diagnostic[] = [];
		const diagnosticCollection = vscode.languages.createDiagnosticCollection("obsoleteDependencies");

		const doc = await vscode.workspace.openTextDocument(packageJsonPath);
		const text = doc.getText();

		for (const dep of obsolete) {
			const regex = new RegExp(`"${dep.name}"\\s*:\\s*"[^"]+"`);
			const match = regex.exec(text);
			
			if (match) {
				const start = doc.positionAt(match.index);
				const end = doc.positionAt(match.index + match[0].length);
				const range = new vscode.Range(start, end);

				const message = `The dependency "${dep.name}" is outdated: ${dep.currentVersion} → ${dep.latestVersion}`;
				const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
				diagnostics.push(diagnostic);
			}
		}

		diagnosticCollection.set(doc.uri, diagnostics);

		if (obsolete.length > 0) {
			vscode.window.showWarningMessage(`${obsolete.length} outdated dependencies were found in package.json`);
		} else {
			vscode.window.showInformationMessage("All dependencies are up to date.");
		}

}


async function checkPeriodicity() {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
  		vscode.window.showErrorMessage("No workspace is opened.");
  		return;
	}

	const packageJsonPath = path.join(workspaceFolders[0].uri.fsPath, 'package.json');	
	if (!fs.existsSync(packageJsonPath)) {
	vscode.window.showErrorMessage("No package.json found in the project.");
	return;
	}	

	const content = fs.readFileSync(packageJsonPath, 'utf-8');
	const json = JSON.parse(content);
	const dependencies = { ...json.dependencies, ...json.devDependencies };

	const outputChannel = vscode.window.createOutputChannel("SansonAI");
	outputChannel.clear();
	outputChannel.show();
	outputChannel.appendLine("Days since last dependency update:\n");

	for (const [name] of Object.entries(dependencies)) {
		try {
		const res = await fetch(`https://registry.npmjs.org/${name}`);
		const data = await res.json() as answerNpm;
		const latestVersion = data['dist-tags'].latest;
		const latestTime = data.time?.[latestVersion];

		if (latestTime) {
			const lastUpdateDate = new Date(latestTime);
			const today = new Date();
			const diffTime = Math.abs(today.getTime() - lastUpdateDate.getTime());
			const diffDays = Math.round(Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
			console.log(diffDays);

			outputChannel.appendLine(`${name} (v${latestVersion}): ${diffDays} days since last update.`);
		} else {
			outputChannel.appendLine(`${name}: The date of the latest version could not be obtained.`);
		}
		} catch (error) {
		outputChannel.appendLine(`${name}: Error getting information from npm.`);
		}
  }
}

export function deactivate() {}
