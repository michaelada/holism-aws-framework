import React from 'react';

const ReactQuill = (props: any) => {
  return React.createElement('textarea', {
    'data-testid': 'quill-editor',
    value: props.value,
    onChange: (e: any) => props.onChange(e.target.value),
  });
};

export default ReactQuill;
