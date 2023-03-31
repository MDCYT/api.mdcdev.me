function formatGuildRollouts(apiResponse) {
    let formattedResponse = [];
  
    for (let i = 0; i < apiResponse.length; i++) {
      let experiment = apiResponse[i];
      let formattedExperiment = {
        id: experiment.data.id,
        type: experiment.data.type,
        title: experiment.data.title,
        description: experiment.data.description,
        buckets: experiment.data.buckets,
        hash: experiment.data.hash,
        populations: []
      };
  
      for (let j = 0; j < experiment.rollout[3].length; j++) {
        let population = experiment.rollout[3][j];
        let formattedPopulation = {
          buckets: [],
          filters: []
        };
  
        for (let k = 0; k < population[0].length; k++) {
          let bucket = population[0][k];
          let formattedBucket = {
            bucket: bucket[0],
            rollout: []
          };
  
          for (let l = 0; l < bucket[1].length; l++) {
            let rollout = bucket[1][l];
            let formattedRollout = {
              start: rollout.s,
              end: rollout.e
            };
  
            formattedBucket.rollout.push(formattedRollout);
          }
  
          formattedPopulation.buckets.push(formattedBucket);
        }
  
        for (let k = 0; k < population[1].length; k++) {
          let filter = population[1][k];
          let formattedFilter;
  
          switch (filter[0]) {
            case 1604612045: // FeatureFilter
              formattedFilter = {
                type: "feature",
                value: filter[1][0]
              };
              break;
            case 2404720969: // IDRangeFilter
              formattedFilter = {
                type: "idRange",
                value: [filter[1][0], filter[1][1]]
              };
              break;
            case 2918402255: // MemberCountFilter
              formattedFilter = {
                type: "memberCount",
                value: [filter[1][0], filter[1][1]]
              };
              break;
            case 3013771838: // IDFilter
              formattedFilter = {
                type: "id",
                value: filter[1][0]
              };
              break;
            case 4148745523: // HubTypeFilter
              formattedFilter = {
                type: "hubType",
                value: filter[1][0]
              };
              break;
            case 2294888943: // RangeByHashFilter
              formattedFilter = {
                type: "rangeByHash",
                value: [filter[1][0], filter[1][1]]
              };
              break;
            default:
              formattedFilter = {
                type: "unknown",
                value: filter
              };
              break;
          }
  
          formattedPopulation.filters.push(formattedFilter);
        }
  
        formattedExperiment.populations.push(formattedPopulation);
      }
  
      formattedResponse.push(formattedExperiment);
    }
  
    return formattedResponse;
  }

module.exports = {
    formatGuildRollouts,
};