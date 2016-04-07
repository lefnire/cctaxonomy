import _ from 'lodash';
import uuid from 'node-uuid';

let data = {
  name: 'Home',
  children: [{
    name: 'Skills',
    children: [{
      name: 'Information Technology',
      children: [{
        name: 'Web Development',
        children: [{
          name: 'Front-end Frameworks',
          children: [{
            name: 'React'
          }, {
            name: 'Angular'
          }]
        }]
      }],
    }, {
      name: 'Medical',
      children: [{
        name: 'Billing and Coding',
        children: [{
          name: 'ICD-10',
        }, {
          name: 'CPT4'
        }, {
          name: 'HCPCS'
        }]
      }]
    }]
  }]
};

const defaults = (row, parent) => {
  _.defaults(row, {
    id: uuid.v4(),
    expanded: true,
    score: 0,
    parent,
    children: []
  });
  row.children.forEach(child => defaults(child, row));
};
defaults(data);

export default data;