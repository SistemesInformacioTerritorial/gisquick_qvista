<template>
    <div class="map-name-bar">
      <div class="logo-panel">
        <img src="@/assets/qvista_logo.svg" alt="Logo" class="logo" />
        <span class="text-logo">qVistaWeb</span>
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
    background-color: var(--color-dark);
    color: var(--color-grey);
    padding: 10px;
    font-size: 18px;
    font-weight: bold;
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
    margin-right: 10px;
  }
  
  .text-logo {
    font-size: 18px;
    font-weight: bold;
  }
  
  .map-name {
    text-align: center;
    flex-grow: 1;
  }
  </style>