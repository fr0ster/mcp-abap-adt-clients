/**
 * Example: Browse virtual folder hierarchy
 *
 * Demonstrates how to fetch virtual folder contents for a package and
 * use the response to build a tree in a consumer.
 */

const { AdtClient } = require('../dist/clients/AdtClient');

const testConfig = {
  host: 'your-sap-host.com',
  username: 'YOUR_USERNAME',
  password: 'YOUR_PASSWORD',
  client: '100',
};

async function browseVirtualFolders() {
  const client = new AdtClient(testConfig);

  try {
    await client.connect();
    console.log('✓ Connected to SAP system');

    const packageName = 'ZOK_TEST_PKG_01';
    console.log(`\n📦 Fetching virtual folders for ${packageName}...`);

    const result = await client.getUtils().getVirtualFoldersContents({
      objectSearchPattern: '*',
      preselection: [{ facet: 'package', values: [packageName] }],
      facetOrder: ['package', 'group', 'type'],
    });

    console.log('✓ Virtual folders response received');
    console.log(`📊 Response size: ${result.data?.length || 0} bytes`);

    // Consumers can parse result.data (XML) to build their tree
    console.log(result.data);
  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await client.disconnect();
    console.log('\n✓ Disconnected from SAP');
  }
}

browseVirtualFolders().catch(console.error);
