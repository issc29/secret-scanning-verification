const core = require('@actions/core');
const github = require('@actions/github');
const yaml = require('js-yaml');
const myToken = core.getInput('github-token');
const octokit = github.getOctokit(myToken)
const csv = require('csvtojson')
const converter = require('json-2-csv');

const fs = require('fs')

const functionsLib = require('actions-api-functions');
var functions = new functionsLib(octokit, core)

run();

async function run() {

  const data = await octokit.rest.repos.getContent({
    owner:"octodemo",
      repo: "secret-scanning-verification",
      path:"alerts.csv"
  })

  const dataFromBase64 = Buffer.from(data.data.content, 'base64').toString()
  const jsonArray =  await csv().fromString(dataFromBase64)
  console.log(jsonArray)

  const mySet1 = new Set()
  for(const item of jsonArray) {
    mySet1.add(item['Alert URL'])
  }
          
  console.log(mySet1)


  const alerts = await octokit.paginate(octokit.rest.secretScanning.listAlertsForOrg,{org:"octodemo", state:"resolved"})
  
  var alertsToAdd = []
  for (alert of alerts) {
    if(mySet1.has(alert.html_url)) {
      continue
    }
    alertsToAdd.push(alert)
  }
  

  /*
  const {data: alerts} = await octokit.rest.secretScanning.listAlertsForOrg(
    {org:"octodemo", state:"resolved"}
    )
    */

    //const alert = alerts[0]
    
    //console.log(alert["resolved_by"].login)
    
  for(alert of alertsToAdd) {
    const result =   await octokit.rest.issues.create(
        { owner:"octodemo",
        repo: "secret-scanning-verification",
        title: `Alert #${alert.number} ${alert.resolution} by ${alert["resolved_by"].login}`,
        body: `# Info: \n* Alert#${alert.number}\n* URL ${alert.html_url}\n* Resolution: ${alert.resolution} \n* Resolved By: ${alert["resolved_by"].login}\n* Secret Type: ${alert.secret_type}\n* Repo: ${alert.repository.full_name}`
      }).catch(e => {console.log(e)})
    }



    for (alert of alertsToAdd) {
      jsonArray.push({'Alert URL': alert.html_url,
       'Issue Opened': 'yes',
       'Issue Closed': 'no'})

    }

  console.log(jsonArray)

  converter.json2csv(jsonArray, (err, csvOut) => {
    if (err) {
        throw err;
    }

    const toBase64data = Buffer.from(csvOut).toString('base64')
    //console.log(Buffer.from(base64data, 'base64').toString())
     
    
      octokit.rest.repos.createOrUpdateFileContents({
      owner:"octodemo",
      repo: "secret-scanning-verification",
      path:"alerts.csv",
      message: "Update CSV",
      sha: data.data.sha,
      "content": toBase64data,
      "committer.name": "bot",
      "committer.email":"issc29@github.com",
      "author.name":"bot",
      "author.email":"issc29@github.com"
    })
    
});




 
}