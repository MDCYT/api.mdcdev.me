function betterGithubProfileData(data) {
    data.createdAtTimestamp = new Date(data.created_at).getTime();
    data.updatedAtTimestamp = new Date(data.updated_at).getTime();

    delete data.events_url;
    delete data.followers_url;
    delete data.following_url;
    delete data.gists_url;
    delete data.hub_url;
    delete data.organizations_url;
    delete data.received_events_url;
    delete data.repos_url;
    delete data.starred_url;
    delete data.subscriptions_url;
    delete data.html_url;
    data.username = data.login;
    delete data.login;

    data.url = `https://github.com/${data.username}`;

    return data;
}

function betterGithubRepositoriesData(data) {
    data.createdAtTimestamp = new Date(data.created_at).getTime();
    data.updatedAtTimestamp = new Date(data.updated_at).getTime();
    data.pushedAtTimestamp = new Date(data.pushed_at).getTime();

    delete data.archive_url;
    delete data.assignees_url;
    delete data.blobs_url;
    delete data.branches_url;
    delete data.clone_url;
    delete data.collaborators_url;
    delete data.comments_url;
    delete data.commits_url;
    delete data.compare_url;
    delete data.contents_url;
    delete data.contributors_url;
    delete data.deployments_url;
    delete data.description;
    delete data.downloads_url;
    delete data.events_url;
    delete data.forks_url;
    delete data.git_commits_url;
    delete data.git_refs_url;
    delete data.git_tags_url;
    delete data.git_url;
    delete data.hooks_url;
    delete data.issue_comment_url;
    delete data.issue_events_url;
    delete data.issues_url;
    delete data.keys_url;
    delete data.labels_url;
    delete data.languages_url;
    delete data.merges_url;
    delete data.milestones_url;
    delete data.notifications_url;
    delete data.pulls_url;
    delete data.releases_url;
    delete data.ssh_url;
    delete data.stargazers_url;
    delete data.statuses_url;
    delete data.subscribers_url;
    delete data.subscription_url;
    delete data.svn_url;
    delete data.tags_url;
    delete data.teams_url;
    delete data.trees_url;
    delete data.permissions;

    data.url = data.html_url;
    delete data.html_url;

    data.owner = betterGithubProfileData(data.owner);

    return data;
}

function betterGithubGistsData(data) {
    data.createdAtTimestamp = new Date(data.created_at).getTime();
    data.updatedAtTimestamp = new Date(data.updated_at).getTime();

    delete data.comments_url;
    delete data.commits_url;
    delete data.forks_url;
    delete data.git_pull_url;
    delete data.git_push_url;

    data.url = data.html_url;
    delete data.html_url;

    data.owner = betterGithubProfileData(data.owner);

    //Convert files to a array
    let files = [];
    for (let key in data.files) {
        files.push(data.files[key]);
    }
    data.files = files;

    return data;
}

function betterGithubCommentData(data) {
    data.createdAtTimestamp = new Date(data.created_at).getTime();
    data.updatedAtTimestamp = new Date(data.updated_at).getTime();

    delete data.html_url;
    delete data.pull_request_url;
    delete data.issue_url;
    delete data.url;

    data.user = betterGithubProfileData(data.user);

    return data;
}

module.exports = {
    betterGithubProfileData,
    betterGithubRepositoriesData,
    betterGithubGistsData,
    betterGithubCommentData
};