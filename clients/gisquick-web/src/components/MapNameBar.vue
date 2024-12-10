<template>
    <div class="map-name-bar">
      <div class="logo-panel">
        <img src="@/assets/qvista_logo.svg" alt="Logo" class="logo" />
        <span class="text-logo">qVista Web</span>
      </div>
      <span class="map-name">{{ mapName }}</span>
    </div>
  </template>
  
  <script>
  export default {
    name: 'MapNameBar',
    props: {
      mapName: {
        type: String,
        required: true
      }
    }
  }
  </script>
  
  <style scoped>
  .map-name-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--qvista-primary-dark);
    color: var(--qvista-color-grey-1);
    padding: 10px;
    font-size: 18px;

    position: relative;
  }
  
  .logo-panel {
    display: flex;
    align-items: center;
    position: absolute;
    left: 10px;
  }
  
  .logo {
    width: 30px;
    height: 30px;
    margin-right: 5px;
  }
  
  .text-logo {
    font-size: 18px;
    font-weight: bold;
    margin-left: 5px;
  }
  
  .map-name {
    text-align: center;
    flex-grow: 1;
  }
  </style>